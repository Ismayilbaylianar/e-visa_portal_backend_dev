import { Injectable, Logger } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions';
import { ApplicationStatus, ActorType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { ErrorCodes } from '@/common/constants';
import {
  MyApplicationsResponseDto,
  MyApplicationItemDto,
  MyApplicationApplicantDto,
  ResubmitDocumentsResponseDto,
} from './dto';
import type { MulterFile } from '../documents/dto';

/**
 * Customer-side portal logic. Owns the /me/applications listing and
 * the M9b document resubmission flow.
 */
@Injectable()
export class CustomerPortalService {
  private readonly logger = new Logger(CustomerPortalService.name);

  /**
   * Internal document type for the issued visa PDF. Mirrored from
   * ApplicantsService — kept duplicated rather than imported to avoid
   * a forwardRef chain just for one constant.
   */
  private static readonly ISSUED_VISA_DOC_TYPE = 'issued_visa';

  /** M9b — same limits as the admin-side document upload. */
  private static readonly MAX_FILES_PER_RESUBMIT = 10;
  private static readonly MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
  ] as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================
  // Listing
  // =========================================================

  async getMyApplications(portalIdentityId: string): Promise<MyApplicationsResponseDto> {
    const applications = await this.prisma.application.findMany({
      where: {
        portalIdentityId,
        deletedAt: null,
      },
      include: {
        destinationCountry: true,
        visaType: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          // Pull just enough document data to compute hasIssuedVisa +
          // uploadedDocumentTypes without leaking storage internals.
          include: {
            documents: {
              where: { deletedAt: null },
              select: { documentTypeKey: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items: MyApplicationItemDto[] = applications.map((app) => {
      const mainApplicant = app.applicants?.find((a) => a.isMainApplicant);
      // The brief asks for an application-level `applicationCode` —
      // we lift it from the main applicant since that's where the
      // backend currently stores it. (Per-applicant codes also exist
      // on each applicant entry below.)
      const applicationCode = mainApplicant?.applicationCode ?? undefined;

      const mappedApplicants: MyApplicationApplicantDto[] = (app.applicants ?? []).map(
        (applicant) => {
          const docTypes = applicant.documents?.map((d) => d.documentTypeKey) ?? [];
          const hasIssuedVisa = docTypes.includes(CustomerPortalService.ISSUED_VISA_DOC_TYPE);
          const uploadedDocumentTypes = docTypes.filter(
            (t) => t !== CustomerPortalService.ISSUED_VISA_DOC_TYPE,
          );
          return {
            id: applicant.id,
            isMainApplicant: applicant.isMainApplicant,
            email: applicant.email,
            status: applicant.status,
            applicationCode: applicant.applicationCode || undefined,
            hasIssuedVisa,
            uploadedDocumentTypes,
          };
        },
      );

      return {
        id: app.id,
        applicationCode,
        currentStatus: app.currentStatus,
        paymentStatus: app.paymentStatus,
        totalFeeAmount: app.totalFeeAmount.toString(),
        currencyCode: app.currencyCode,
        expedited: app.expedited,
        requestedDocumentTypes: app.requestedDocumentTypes?.length
          ? app.requestedDocumentTypes
          : undefined,
        estimatedProcessingDays: app.estimatedProcessingDays ?? null,
        estimatedTimeUpdatedAt: app.estimatedTimeUpdatedAt ?? null,
        rejectionReason: app.rejectionReason || undefined,
        adminNote: app.adminNote || undefined,
        destinationCountry: app.destinationCountry
          ? {
              id: app.destinationCountry.id,
              name: app.destinationCountry.name,
              isoCode: app.destinationCountry.isoCode,
            }
          : undefined,
        visaType: app.visaType
          ? {
              id: app.visaType.id,
              purpose: app.visaType.purpose,
              label: app.visaType.label,
            }
          : undefined,
        applicants: mappedApplicants,
        createdAt: app.createdAt,
        updatedAt: app.updatedAt,
      };
    });

    this.logger.log(
      `Retrieved ${items.length} applications for portal identity: ${portalIdentityId}`,
    );

    return {
      items,
      total: items.length,
    };
  }

  // =========================================================
  // M9b — Document resubmission
  // =========================================================

  /**
   * Customer document resubmission for a NEED_DOCS application.
   *
   * Flow:
   *  1. Validate ownership + status + counts.
   *  2. For each file: validate type+size, look up the matching
   *     requested doc type, soft-delete the prior document (if any)
   *     of that type, store the new file, write the Document row.
   *  3. After the loop, if every requestedDocumentType is now
   *     satisfied, atomically: flip application.status to SUBMITTED,
   *     clear requestedDocumentTypes, write status history, audit,
   *     and queue the admin notification email.
   *  4. Return uploaded count + new status + remaining types.
   *
   * Atomicity: the per-file insert + soft-delete is one transaction
   * each (so a partial failure doesn't leave the customer staring at
   * a half-uploaded set with no visible error). The status flip is
   * its own transaction, run only when the post-loop count check
   * passes — no chance of flipping early.
   */
  async resubmitDocuments(
    applicationId: string,
    applicantId: string,
    portalIdentityId: string,
    files: MulterFile[],
    types: string[],
    ip?: string,
    userAgent?: string,
  ): Promise<ResubmitDocumentsResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'At least one file is required' },
      ]);
    }
    if (files.length > CustomerPortalService.MAX_FILES_PER_RESUBMIT) {
      throw new BadRequestException('Too many files', [
        {
          reason: ErrorCodes.RESUBMIT_FILE_LIMIT_EXCEEDED,
          message: `A single resubmission can include at most ${CustomerPortalService.MAX_FILES_PER_RESUBMIT} files`,
        },
      ]);
    }
    if (!Array.isArray(types) || types.length !== files.length) {
      throw new BadRequestException('types[] must align with files[]', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Provide one documentTypeKey per file in `types[]` (same order as files[]).',
        },
      ]);
    }

    // Load the applicant + application + requested types in one query.
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, applicationId, deletedAt: null },
      include: {
        application: {
          select: {
            id: true,
            portalIdentityId: true,
            currentStatus: true,
            requestedDocumentTypes: true,
            adminNote: true,
          },
        },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        { reason: ErrorCodes.APPLICANT_NOT_FOUND, message: 'Applicant does not exist' },
      ]);
    }
    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not own this application' },
      ]);
    }
    if (applicant.application.currentStatus !== ApplicationStatus.NEED_DOCS) {
      throw new ConflictException('Application is not in NEED_DOCS state', [
        {
          reason: ErrorCodes.NOT_NEED_DOCS_STATE,
          message: `Cannot resubmit documents from state ${applicant.application.currentStatus}`,
        },
      ]);
    }

    const requestedTypes = applicant.application.requestedDocumentTypes ?? [];

    // Validate every type+file BEFORE writing anything. Saves us from
    // partial-state cleanup if file #3 is the bad one.
    for (let i = 0; i < files.length; i++) {
      this.validateFile(files[i], i);
      if (!requestedTypes.includes(types[i])) {
        throw new BadRequestException('Document type not requested', [
          {
            reason: ErrorCodes.DOCUMENT_TYPE_NOT_REQUESTED,
            message: `Document type "${types[i]}" was not requested for this application. Requested: ${requestedTypes.join(', ') || '(none)'}`,
          },
        ]);
      }
    }

    // Process each file: storage upload + DB swap.
    let uploaded = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const documentTypeKey = types[i];
      await this.replaceDocument({
        applicantId,
        applicationId,
        documentTypeKey,
        file,
        ip,
        userAgent,
      });
      uploaded++;
    }

    // Re-evaluate completion. We re-fetch documents fresh rather than
    // trusting the in-memory list since concurrent uploads on a
    // different session would otherwise be invisible.
    const docsNow = await this.prisma.document.findMany({
      where: { applicationApplicantId: applicantId, deletedAt: null },
      select: { documentTypeKey: true },
    });
    const presentTypes = new Set(docsNow.map((d) => d.documentTypeKey));
    const remainingTypes = requestedTypes.filter((t) => !presentTypes.has(t));

    if (remainingTypes.length > 0) {
      // Still missing some — leave the app in NEED_DOCS so the admin
      // queue isn't polluted with half-resubmitted apps.
      this.logger.log(
        `Resubmit partial: applicant=${applicantId} uploaded=${uploaded} remaining=${remainingTypes.join(',')}`,
      );
      return {
        uploaded,
        applicationStatus: ApplicationStatus.NEED_DOCS,
        requestedTypesRemaining: remainingTypes,
      };
    }

    // All requested types are satisfied — flip back to SUBMITTED.
    const now = new Date();
    const oldStatus = ApplicationStatus.NEED_DOCS;
    const newStatus = ApplicationStatus.SUBMITTED;

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: {
          currentStatus: newStatus,
          requestedDocumentTypes: [],
          updatedAt: now,
        },
      }),
      this.prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          oldStatus,
          newStatus,
          note: 'Customer resubmitted requested documents',
          changedBySystem: false,
          // No changedByUserId — the actor is the portal identity, not
          // an admin user. Audit log carries the portal-identity actor.
        },
      }),
    ]);

    // Audit: one summary entry for the status flip (per-file audits
    // already happened in replaceDocument).
    await this.auditLogsService.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'application.documents.resubmitted',
      entityType: 'Application',
      entityId: applicationId,
      oldValue: { status: oldStatus, requestedDocumentTypes: requestedTypes },
      newValue: {
        status: newStatus,
        applicantId,
        uploadedTypes: types,
        actorType: 'PORTAL_IDENTITY',
      },
      ipAddress: ip,
      userAgent,
    });

    // Notify admin team. Best-effort — never block the customer
    // response on email failure.
    await this.notifyAdminOfResubmission(applicationId, types).catch((err) => {
      this.logger.error(`Failed to send resubmission email: ${err}`);
    });

    this.logger.log(
      `Resubmit complete: applicant=${applicantId} app=${applicationId} flipped NEED_DOCS -> SUBMITTED`,
    );

    return {
      uploaded,
      applicationStatus: newStatus,
      requestedTypesRemaining: [],
    };
  }

  // =========================================================
  // Helpers
  // =========================================================

  private validateFile(file: MulterFile, index: number): void {
    if (!file || !file.buffer) {
      throw new BadRequestException(`File at index ${index} is empty`, [
        { reason: ErrorCodes.BAD_REQUEST, message: 'File buffer missing' },
      ]);
    }
    if (file.size > CustomerPortalService.MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.FILE_TOO_LARGE,
          message: `File "${file.originalname}" exceeds ${CustomerPortalService.MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit`,
        },
      ]);
    }
    if (!CustomerPortalService.ALLOWED_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException('Invalid file type', [
        {
          reason: ErrorCodes.FILE_TYPE_NOT_ALLOWED,
          message: `File "${file.originalname}" has type ${file.mimetype}. Allowed: ${CustomerPortalService.ALLOWED_MIME_TYPES.join(', ')}`,
        },
      ]);
    }
  }

  /**
   * Soft-delete any existing document of `documentTypeKey` for this
   * applicant, then upload the new file and create the Document row.
   * Per-file audit goes here so partial successes still leave a trail.
   */
  private async replaceDocument(args: {
    applicantId: string;
    applicationId: string;
    documentTypeKey: string;
    file: MulterFile;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const { applicantId, applicationId, documentTypeKey, file, ip, userAgent } = args;

    const existing = await this.prisma.document.findFirst({
      where: {
        applicationApplicantId: applicantId,
        documentTypeKey,
        deletedAt: null,
      },
    });

    const prefix = `documents/${applicantId}`;
    const uploadResult = await this.storageService.upload(file.buffer, {
      contentType: file.mimetype,
      prefix,
      originalFilename: file.originalname,
      metadata: {
        applicantId,
        applicationId,
        documentTypeKey,
        source: 'portal-resubmit',
      },
    });

    const checksum =
      uploadResult.checksum ??
      crypto.createHash('sha256').update(file.buffer).digest('hex');
    const now = new Date();

    // Sequence: soft-delete the old (if any), then create the new.
    // Wrapped in a transaction so we never end up with two active
    // documents of the same type for one applicant.
    const newDoc = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.document.update({
          where: { id: existing.id },
          data: { deletedAt: now },
        });
      }
      return tx.document.create({
        data: {
          applicationApplicantId: applicantId,
          documentTypeKey,
          originalFileName: file.originalname,
          storageFileName: uploadResult.filename,
          storagePath: prefix,
          storageKey: uploadResult.storageKey,
          storageProvider: this.storageService.getProviderName(),
          mimeType: file.mimetype,
          fileSize: uploadResult.size,
          checksum,
          // Resubmissions return to PENDING — admin has to re-review.
          reviewStatus: 'PENDING',
        },
      });
    });

    const auditOldValue: Record<string, unknown> | undefined = existing
      ? {
          documentId: existing.id,
          originalFileName: existing.originalFileName,
          fileSize: existing.fileSize,
        }
      : undefined;

    await this.auditLogsService.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'applicant.documents.resubmit',
      entityType: 'Document',
      entityId: newDoc.id,
      oldValue: auditOldValue,
      newValue: {
        documentId: newDoc.id,
        documentTypeKey,
        fileName: file.originalname,
        fileSize: uploadResult.size,
        applicantId,
        applicationId,
        replacedDocumentId: existing?.id,
      },
      ipAddress: ip,
      userAgent,
    });
  }

  /**
   * Resolve admin notification recipient + send via the templated
   * email service. Falls back to logging when no recipient is
   * configured — never throws.
   */
  private async notifyAdminOfResubmission(
    applicationId: string,
    uploadedTypes: string[],
  ): Promise<void> {
    const setting = await this.prisma.setting.findFirst({
      select: { supportEmail: true, siteUrl: true, notificationEmailEnabled: true },
    });

    if (!setting?.notificationEmailEnabled) {
      this.logger.log(`Resubmit notify skipped — notificationEmailEnabled is false`);
      return;
    }
    const recipient = setting.supportEmail;
    if (!recipient) {
      this.logger.warn('Resubmit notify skipped — no supportEmail configured');
      return;
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: { email: true, formDataJson: true, applicationCode: true },
        },
      },
    });
    if (!app) return;

    const mainCode = app.applicants[0]?.applicationCode ?? applicationId.slice(0, 8).toUpperCase();
    const applicantNames = app.applicants
      .map((a) => {
        const fd = (a.formDataJson ?? {}) as Record<string, unknown>;
        const first = typeof fd.firstName === 'string' ? fd.firstName : '';
        const last = typeof fd.lastName === 'string' ? fd.lastName : '';
        const full = `${first} ${last}`.trim();
        return full || a.email;
      })
      .join(', ');

    const adminAppLink = setting.siteUrl
      ? `${setting.siteUrl.replace(/\/$/, '')}/admin/applications/${applicationId}`
      : `/admin/applications/${applicationId}`;

    await this.emailService.sendTemplatedEmail({
      to: recipient,
      templateKey: 'application.documents.resubmitted',
      variables: {
        adminName: 'Team',
        applicationCode: mainCode,
        applicantNames,
        documentsList: uploadedTypes.join(', '),
        appLink: adminAppLink,
      },
      relatedEntity: 'Application',
      relatedEntityId: applicationId,
    });
  }
}
