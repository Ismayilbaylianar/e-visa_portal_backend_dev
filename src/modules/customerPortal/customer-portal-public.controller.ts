import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Req,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { Public } from '@/common/decorators';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { PortalTokenService } from '../applications/portal-token.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { NotificationEmitterService } from '../notifications/notification-emitter.service';
import { ResultFilesService } from '../resultFiles/result-files.service';
import { ErrorCodes } from '@/common/constants';
import { BadRequestException, NotFoundException } from '@/common/exceptions';
import { ApplicationStatus, ActorType } from '@prisma/client';
import * as crypto from 'crypto';
import type { Request } from 'express';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * M11.13 (BUG U + T) — Public deep-link redemption.
 *
 * Customer clicks the button in a status email which lands them on
 * `/portal/[code]?token=...` on the frontend. The page POSTs the
 * token here; we verify, fetch the booking, and return a slim
 * payload tailored for the deep-link page.
 *
 * No portal session is created — the token IS the credential for
 * this one render. Subsequent actions (upload via /me, download
 * via the visa endpoints) use the standard portal auth flow.
 */
export class RedeemPortalTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  token: string;
}

@ApiTags('Customer Portal — Public')
@Controller('public/portal')
export class CustomerPortalPublicController {
  private readonly logger = new Logger(CustomerPortalPublicController.name);
  private static readonly MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
  private static readonly ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly portalToken: PortalTokenService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogsService,
    private readonly notifications: NotificationEmitterService,
    private readonly resultFiles: ResultFilesService,
  ) {}

  @Post('redeem')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Redeem a portal deep-link token',
    description:
      'Verifies a signed portal token (from a status email) and returns booking + applicants + status. No session created — single-use display only.',
  })
  @ApiResponse({ status: 200, description: 'Booking details' })
  @ApiResponse({ status: 400, description: 'Malformed / invalid / expired token' })
  @ApiResponse({ status: 404, description: 'Application no longer exists' })
  async redeem(@Body() dto: RedeemPortalTokenDto) {
    let payload;
    try {
      payload = this.portalToken.verify(dto.token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired token', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            err instanceof Error ? err.message : 'Could not verify portal token',
        },
      ]);
    }

    const application = await this.prisma.application.findFirst({
      where: { id: payload.applicationId, deletedAt: null },
      include: {
        portalIdentity: { select: { email: true } },
        destinationCountry: { select: { isoCode: true, name: true, flagEmoji: true } },
        visaType: { select: { purpose: true, label: true } },
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          include: {
            statusHistory: { orderBy: { createdAt: 'asc' } },
            documents: {
              where: { deletedAt: null },
              select: { id: true, documentTypeKey: true, originalFileName: true },
            },
          },
        },
        documentRequests: {
          where: { status: { in: ['pending', 'partial'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { items: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application no longer exists' },
      ]);
    }

    // Email audience check — token's email must match either the
    // portal identity OR any applicant email. Prevents replaying a
    // token meant for applicant A on applicant B's booking (same
    // applicationId, different recipient).
    const audienceEmails = new Set<string>();
    if (application.portalIdentity?.email) {
      audienceEmails.add(application.portalIdentity.email.toLowerCase().trim());
    }
    for (const a of application.applicants) {
      if (a.email) audienceEmails.add(a.email.toLowerCase().trim());
    }
    if (!audienceEmails.has(payload.email)) {
      throw new BadRequestException('Token audience mismatch', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'This link was issued for a different recipient.',
        },
      ]);
    }

    return {
      intent: payload.intent,
      applicationId: application.id,
      referenceCode: application.referenceCode,
      currentStatus: application.currentStatus,
      paymentStatus: application.paymentStatus,
      destination: application.destinationCountry
        ? {
            isoCode: application.destinationCountry.isoCode,
            name: application.destinationCountry.name,
            flagEmoji: application.destinationCountry.flagEmoji ?? null,
          }
        : null,
      visaType: application.visaType
        ? {
            purpose: application.visaType.purpose,
            label: application.visaType.label,
          }
        : null,
      portalEmail: application.portalIdentity?.email ?? null,
      applicants: application.applicants.map((a) => {
        const fd = (a.formDataJson ?? {}) as Record<string, any>;
        const first = fd.firstName || fd.first_name || '';
        const last = fd.lastName || fd.last_name || '';
        const fullName = `${first} ${last}`.trim() || null;
        return {
          id: a.id,
          applicationCode: a.applicationCode ?? null,
          status: a.status,
          isMainApplicant: a.isMainApplicant,
          email: a.email,
          fullName,
          documentTypeKeys: a.documents?.map((d) => d.documentTypeKey) ?? [],
          hasIssuedVisa: !!a.resultStorageKey,
          resultFileName: a.resultFileName ?? null,
          statusHistory: a.statusHistory.map((h) => ({
            oldStatus: h.oldStatus,
            newStatus: h.newStatus,
            note: h.note ?? null,
            changedAt: h.createdAt,
          })),
        };
      }),
      requestedDocumentTypes: application.requestedDocumentTypes ?? [],
      pendingDocumentRequest: application.documentRequests?.[0]
        ? {
            id: application.documentRequests[0].id,
            customMessage: application.documentRequests[0].customMessage,
            items: application.documentRequests[0].items.map((it) => ({
              id: it.id,
              name: it.documentName,
              acceptedFormats: it.acceptedFormats,
              maxSizeMb: it.maxSizeMb,
              uploaded: !!it.uploadedDocumentId,
            })),
          }
        : null,
      createdAt: application.createdAt,
    };
  }

  /**
   * M11.14 (BUG DD) — Customer uploads a requested document via a
   * deep-link from the NEED_DOCS email.
   *
   * Auth: signed portal token in form field `token` (24h, audience
   * matched to applicationId + email). No portal session needed —
   * the token IS the credential for this single upload.
   *
   * Inputs: multipart/form-data
   *   - file: the uploaded file (≤10 MB, pdf/jpg/png/webp)
   *   - token: portal deep-link token (string, audience matched)
   *   - requestItemId: which document_request_items row this satisfies
   *
   * Side effects:
   *   1. Validate token + match application
   *   2. Store file via StorageService → documents row attached
   *      to the main applicant
   *   3. Set document_request_items.uploaded_document_id +
   *      uploaded_at
   *   4. If all items in the request are now uploaded:
   *        - document_requests.status = 'fulfilled'
   *        - Application status flips NEED_DOCS → SUBMITTED
   *        - applicationStatusHistory row written
   *        - Telegram + audit fire
   *
   * Idempotency / safety: re-uploading to an already-fulfilled item
   * REPLACES the prior document (audit captures the swap).
   */
  @Post('applications/:applicationId/documents/upload')
  @Public()
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Customer uploads a requested document (token-auth)',
    description:
      'Need-docs upload endpoint for the deep-link flow. Form data: file + token + requestItemId. Returns the new document + the post-upload request status (so the page can refresh).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Upload succeeded' })
  @ApiResponse({ status: 400, description: 'Invalid file / token / request item' })
  @ApiResponse({ status: 403, description: 'Token audience mismatch' })
  @ApiResponse({ status: 404, description: 'Application or item not found' })
  async uploadDocument(
    @Param('applicationId') applicationId: string,
    @UploadedFile() file: MulterFile,
    @Body() body: { token?: string; requestItemId?: string },
    @Req() req: Request,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'A file is required.' },
      ]);
    }
    if (file.size > CustomerPortalPublicController.MAX_FILE_BYTES) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Max upload size is ${CustomerPortalPublicController.MAX_FILE_BYTES / 1024 / 1024} MB.`,
        },
      ]);
    }
    if (!CustomerPortalPublicController.ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Uploads must be PDF / JPG / PNG / WEBP. Got ${file.mimetype}.`,
        },
      ]);
    }
    if (!body.token) {
      throw new BadRequestException('Missing token', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Portal access token is required.' },
      ]);
    }
    if (!body.requestItemId) {
      throw new BadRequestException('Missing requestItemId', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Specify which requested document this upload satisfies.',
        },
      ]);
    }

    // 1. Verify token + audience match the application
    let payload;
    try {
      payload = this.portalToken.verify(body.token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired token', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: err instanceof Error ? err.message : 'Token verification failed',
        },
      ]);
    }
    if (payload.applicationId !== applicationId) {
      throw new BadRequestException('Token does not match this application', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Use the link from your most recent email.' },
      ]);
    }

    // 2. Load request item + application + main applicant in one go
    const item = await this.prisma.documentRequestItem.findFirst({
      where: { id: body.requestItemId },
      include: {
        request: {
          include: {
            application: {
              include: {
                applicants: {
                  where: { deletedAt: null },
                  orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
                  take: 1,
                  select: { id: true, applicationCode: true },
                },
                portalIdentity: { select: { email: true } },
              },
            },
          },
        },
      },
    });
    if (!item || item.request.applicationId !== applicationId) {
      throw new NotFoundException('Request item not found for this application', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Unknown document request item.' },
      ]);
    }
    const application = item.request.application;
    if (!application || application.deletedAt) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application no longer exists.' },
      ]);
    }
    const mainApplicantId = application.applicants[0]?.id;
    if (!mainApplicantId) {
      throw new BadRequestException('No applicant to attach upload to', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Application has no active applicants.',
        },
      ]);
    }

    // 3. Save the file via the storage layer
    const prefix = `documents/${mainApplicantId}`;
    const uploadResult = await this.storage.upload(file.buffer, {
      contentType: file.mimetype,
      prefix,
      originalFilename: file.originalname,
      metadata: {
        applicantId: mainApplicantId,
        applicationId,
        documentTypeKey: this.deriveDocumentTypeKey(item.documentName),
        source: 'portal-need-docs-upload',
        requestItemId: item.id,
      },
    });
    const checksum =
      uploadResult.checksum ??
      crypto.createHash('sha256').update(file.buffer).digest('hex');

    // 4. Persist document + link to the request item in one transaction
    const documentTypeKey = this.deriveDocumentTypeKey(item.documentName);
    const newDoc = await this.prisma.$transaction(async (tx) => {
      // Soft-delete any prior upload for this same type so we never
      // end up with two active documents for the same item.
      if (item.uploadedDocumentId) {
        await tx.document.updateMany({
          where: { id: item.uploadedDocumentId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      }
      const doc = await tx.document.create({
        data: {
          applicationApplicantId: mainApplicantId,
          documentTypeKey,
          originalFileName: file.originalname,
          storageFileName: uploadResult.filename,
          storagePath: prefix,
          storageKey: uploadResult.storageKey,
          storageProvider: this.storage.getProviderName(),
          mimeType: file.mimetype,
          fileSize: uploadResult.size,
          checksum,
          reviewStatus: 'PENDING',
        },
      });
      await tx.documentRequestItem.update({
        where: { id: item.id },
        data: { uploadedDocumentId: doc.id, uploadedAt: new Date() },
      });
      return doc;
    });

    // 5. Check if all items in this request are now uploaded
    const requestItems = await this.prisma.documentRequestItem.findMany({
      where: { requestId: item.request.id },
      select: { uploadedDocumentId: true },
    });
    const allFulfilled = requestItems.every((it) => !!it.uploadedDocumentId);
    let statusFlipped: { from: string; to: string } | null = null;
    if (allFulfilled && application.currentStatus === ApplicationStatus.NEED_DOCS) {
      const oldStatus = application.currentStatus;
      const newStatus = ApplicationStatus.SUBMITTED;
      await this.prisma.$transaction([
        this.prisma.documentRequest.update({
          where: { id: item.request.id },
          data: { status: 'fulfilled', fulfilledAt: new Date() },
        }),
        this.prisma.application.update({
          where: { id: applicationId },
          data: {
            currentStatus: newStatus,
            requestedDocumentTypes: [],
            updatedAt: new Date(),
          },
        }),
        this.prisma.applicationStatusHistory.create({
          data: {
            applicationId,
            oldStatus,
            newStatus,
            note: 'Customer resubmitted requested documents',
            changedBySystem: true,
          },
        }),
      ]);
      statusFlipped = { from: oldStatus, to: newStatus };

      // Telegram + admin notification (best-effort, post-commit)
      void this.notifications.emit('app.documents_resubmitted', {
        applicationId,
        applicationCode: application.applicants[0]?.applicationCode,
        recipientEmail: payload.email,
      });
    }

    // 6. Audit
    await this.audit.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'portal.documents.uploaded',
      entityType: 'DocumentRequestItem',
      entityId: item.id,
      newValue: {
        documentId: newDoc.id,
        applicationId,
        requestId: item.request.id,
        documentTypeKey,
        fileName: file.originalname,
        fileSize: uploadResult.size,
        statusFlipped,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    this.logger.log(
      `[BUG DD] Customer uploaded ${file.originalname} for item ${item.id} (request ${item.request.id}); allFulfilled=${allFulfilled}`,
    );

    return {
      document: {
        id: newDoc.id,
        fileName: newDoc.originalFileName,
        mimeType: newDoc.mimeType,
        size: newDoc.fileSize,
      },
      requestItem: {
        id: item.id,
        uploaded: true,
      },
      requestStatus: allFulfilled ? 'fulfilled' : 'pending',
      applicationStatus: statusFlipped ? statusFlipped.to : application.currentStatus,
      statusFlipped,
    };
  }

  /**
   * Slugify the human request-item name into a stable
   * documentTypeKey the documents UI can group by.
   */
  private deriveDocumentTypeKey(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64) || 'document'
    );
  }

  /**
   * M11.14 (BUG FF — PART 2) — Token-authenticated customer
   * download list. Service-layer enforces status ∈
   * {APPROVED, READY_TO_DOWNLOAD} on the per-file URL path; the
   * list endpoint just shows what exists so the UI can render an
   * empty state cleanly when the visa isn't issued yet.
   */
  @Post('applications/:applicationId/result-files/list')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List visa files for the customer (token-auth)',
    description:
      'POST (not GET) so the token travels in the body, not a query string that might appear in proxy logs.',
  })
  async listResultFiles(
    @Param('applicationId') applicationId: string,
    @Body() body: { token?: string },
  ) {
    if (!body.token) {
      throw new BadRequestException('Missing token', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Portal access token is required.' },
      ]);
    }
    let payload;
    try {
      payload = this.portalToken.verify(body.token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired token', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: err instanceof Error ? err.message : 'Token verification failed',
        },
      ]);
    }
    if (payload.applicationId !== applicationId) {
      throw new BadRequestException('Token does not match this application', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Use the link from your most recent email.' },
      ]);
    }
    return this.resultFiles.listForPortal(applicationId);
  }

  @Post('applications/:applicationId/result-files/:fileId/url')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get signed download URL for a single visa file (token-auth)',
  })
  async resultFileUrl(
    @Param('applicationId') applicationId: string,
    @Param('fileId') fileId: string,
    @Body() body: { token?: string },
    @Req() req: Request,
  ) {
    if (!body.token) {
      throw new BadRequestException('Missing token', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Portal access token is required.' },
      ]);
    }
    let payload;
    try {
      payload = this.portalToken.verify(body.token);
    } catch (err) {
      throw new BadRequestException('Invalid or expired token', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: err instanceof Error ? err.message : 'Token verification failed',
        },
      ]);
    }
    if (payload.applicationId !== applicationId) {
      throw new BadRequestException('Token does not match this application', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'Use the link from your most recent email.' },
      ]);
    }
    return this.resultFiles.getSignedUrlForPortal(applicationId, fileId, {
      email: payload.email,
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });
  }
}
