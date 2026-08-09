import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { LocalStorageProvider } from '../storage/providers/local-storage.provider';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * Document type that `ApplicantsService.issueVisa()` writes for an
 * issued visa. Kept in sync with `ApplicantsService.ISSUED_VISA_DOC_TYPE`
 * and `CustomerPortalService.ISSUED_VISA_DOC_TYPE`.
 */
const RESULT_ISSUED_VISA_DOC_TYPE = 'issued_visa';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * M11.14 (BUG FF — PART 2) — Operator-uploaded result files
 * (issued visa PDF + optional supporting files). Customer pulls
 * them via the public portal once status ∈ {APPROVED,
 * READY_TO_DOWNLOAD, DONE}.
 */
@Injectable()
export class ResultFilesService {
  private readonly logger = new Logger(ResultFilesService.name);
  private static readonly MAX_BYTES = 20 * 1024 * 1024; // 20 MB
  private static readonly ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly localStorage: LocalStorageProvider,
    private readonly audit: AuditLogsService,
  ) {}

  async upload(args: {
    applicationId: string;
    applicantId?: string | null;
    file: MulterFile;
    description?: string;
    isPrimary?: boolean;
    actorUserId: string;
    ip?: string;
    userAgent?: string;
  }) {
    const {
      applicationId,
      applicantId,
      file,
      description,
      isPrimary,
      actorUserId,
      ip,
      userAgent,
    } = args;

    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'File is required.' },
      ]);
    }
    if (file.size > ResultFilesService.MAX_BYTES) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Max size is ${ResultFilesService.MAX_BYTES / 1024 / 1024} MB.`,
        },
      ]);
    }
    if (!ResultFilesService.ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: `Accepted: PDF / JPG / PNG / WEBP. Got ${file.mimetype}.`,
        },
      ]);
    }

    // Validate application + (optional) applicant ownership.
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application does not exist.' },
      ]);
    }
    if (applicantId) {
      const applicant = await this.prisma.applicationApplicant.findFirst({
        where: { id: applicantId, applicationId, deletedAt: null },
        select: { id: true },
      });
      if (!applicant) {
        throw new BadRequestException('Applicant not on this application', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: 'The given applicantId does not belong to this application.',
          },
        ]);
      }
    }

    // Storage upload.
    const prefix = `visas/${applicationId}`;
    const uploadResult = await this.storage.upload(file.buffer, {
      contentType: file.mimetype,
      prefix,
      originalFilename: file.originalname,
      metadata: {
        applicationId,
        applicantId: applicantId ?? '',
        uploadedBy: actorUserId,
        source: 'admin-result-file',
      },
    });

    // Persist + (optionally) flip is_primary on existing rows.
    const created = await this.prisma.$transaction(async (tx) => {
      if (isPrimary) {
        // Demote any other primary so the partial unique index
        // doesn't fire on the insert below.
        await tx.applicationResultFile.updateMany({
          where: { applicationId, isPrimary: true, deletedAt: null },
          data: { isPrimary: false },
        });
      }
      return tx.applicationResultFile.create({
        data: {
          applicationId,
          applicantId: applicantId ?? null,
          fileName: file.originalname,
          storageKey: uploadResult.storageKey,
          storagePath: prefix,
          storageProvider: this.storage.getProviderName(),
          fileSize: uploadResult.size,
          mimeType: file.mimetype,
          description: description?.trim() || null,
          isPrimary: !!isPrimary,
          uploadedBy: actorUserId,
        },
      });
    });

    await this.audit.create({
      actorType: ActorType.USER,
      actorUserId: actorUserId,
      actionKey: 'result_file.uploaded',
      entityType: 'ApplicationResultFile',
      entityId: created.id,
      newValue: {
        applicationId,
        applicantId,
        fileName: created.fileName,
        fileSize: created.fileSize,
        isPrimary: created.isPrimary,
      },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(
      `[BUG FF] Result file uploaded: ${created.id} for app ${applicationId} (primary=${created.isPrimary})`,
    );
    return this.mapToResponse(created);
  }

  async listForApplication(applicationId: string) {
    const files = await this.prisma.applicationResultFile.findMany({
      where: { applicationId, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { uploadedAt: 'desc' }],
      include: {
        uploader: { select: { id: true, fullName: true, email: true } },
        applicant: {
          select: { id: true, applicationCode: true, formDataJson: true },
        },
      },
    });
    return files.map((f) => this.mapToResponse(f));
  }

  /** Signed URL for admin preview/download. */
  async getSignedUrl(applicationId: string, fileId: string, inline: boolean) {
    const file = await this.prisma.applicationResultFile.findFirst({
      where: { id: fileId, applicationId, deletedAt: null },
    });
    if (!file) {
      throw new NotFoundException('Result file not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'File no longer exists.' },
      ]);
    }
    // Reuse the LocalStorageProvider HMAC-signed URL flow (M11.11
    // BUG C). 1-hour TTL.
    const url = await this.localStorage.getSignedUrl(file.storageKey, {
      expiresIn: 60 * 60,
      contentDisposition: inline
        ? `inline; filename="${file.fileName}"`
        : `attachment; filename="${file.fileName}"`,
    });
    return { url, fileName: file.fileName };
  }

  async softDelete(applicationId: string, fileId: string, actorUserId: string) {
    const file = await this.prisma.applicationResultFile.findFirst({
      where: { id: fileId, applicationId, deletedAt: null },
    });
    if (!file) {
      throw new NotFoundException('Result file not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'File no longer exists.' },
      ]);
    }
    await this.prisma.applicationResultFile.update({
      where: { id: fileId },
      data: { deletedAt: new Date() },
    });
    await this.audit.create({
      actorType: ActorType.USER,
      actorUserId: actorUserId,
      actionKey: 'result_file.deleted',
      entityType: 'ApplicationResultFile',
      entityId: fileId,
      oldValue: {
        fileName: file.fileName,
        wasPrimary: file.isPrimary,
      },
    });
    this.logger.log(`[BUG FF] Result file deleted: ${fileId}`);
  }

  /**
   * Customer-side variant — same shape, but the caller validated
   * the portal token already. Used by the public portal endpoint.
   */
  /**
   * Issued visas live in `documents` under the `issued_visa` type —
   * that is what `issueVisa()` writes, what the authenticated portal
   * download serves, and what `/me` reads for `hasIssuedVisa`. The
   * magic-link page listed only `application_result_files`, so a
   * customer who clicked "your visa is ready" saw nothing to download
   * (found on prod, 2026-08-09).
   *
   * We READ the documents rows rather than also writing a result-file
   * row per visa: one file means one row, there is nothing to keep in
   * sync, and every visa issued before this fix works immediately with
   * no backfill. `application_result_files` keeps its own job —
   * admin-uploaded supplementary files — and is listed alongside.
   */
  private async listIssuedVisaDocuments(applicationId: string) {
    const docs = await this.prisma.document.findMany({
      where: {
        documentTypeKey: RESULT_ISSUED_VISA_DOC_TYPE,
        deletedAt: null,
        applicationApplicant: { applicationId, deletedAt: null },
      },
      include: {
        applicationApplicant: {
          select: { id: true, applicationCode: true, isMainApplicant: true },
        },
      },
    });

    // Main applicant first, then co-applicants by code — the order the
    // customer expects to see their own visa in.
    docs.sort((a, b) => {
      const am = a.applicationApplicant?.isMainApplicant ? 0 : 1;
      const bm = b.applicationApplicant?.isMainApplicant ? 0 : 1;
      if (am !== bm) return am - bm;
      return (a.applicationApplicant?.applicationCode ?? '').localeCompare(
        b.applicationApplicant?.applicationCode ?? '',
      );
    });

    return docs.map((d) => ({
      id: d.id,
      applicationId,
      applicantId: d.applicationApplicantId,
      fileName: d.originalFileName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      description: d.applicationApplicant?.applicationCode
        ? `Visa — ${d.applicationApplicant.applicationCode}`
        : 'Issued visa',
      // The visa is what the customer came for; surface it first.
      isPrimary: true,
      uploadedAt: d.createdAt,
      uploadedBy: undefined,
      applicant: d.applicationApplicant
        ? {
            id: d.applicationApplicant.id,
            applicationCode: d.applicationApplicant.applicationCode,
          }
        : undefined,
    }));
  }

  async listForPortal(applicationId: string) {
    const [visas, extras] = await Promise.all([
      this.listIssuedVisaDocuments(applicationId),
      this.listForApplication(applicationId),
    ]);
    // Only one primary card renders on the portal page, so demote the
    // supplementary files rather than competing with the visa.
    return [...visas, ...extras.map((f) => ({ ...f, isPrimary: false }))];
  }

  async getSignedUrlForPortal(
    applicationId: string,
    fileId: string,
    args: { email: string; ip?: string; userAgent?: string },
  ) {
    // `listForPortal` now also returns issued-visa documents, so an id
    // arriving here can be either kind. Both models expose a
    // `storageKey`, so once resolved the rest of the flow is identical.
    const resultFile = await this.prisma.applicationResultFile.findFirst({
      where: { id: fileId, applicationId, deletedAt: null },
    });
    let file: { storageKey: string; fileName: string } | null = resultFile
      ? { storageKey: resultFile.storageKey, fileName: resultFile.fileName }
      : null;
    let entityType = 'ApplicationResultFile';

    if (!file) {
      const visaDoc = await this.prisma.document.findFirst({
        where: {
          id: fileId,
          documentTypeKey: RESULT_ISSUED_VISA_DOC_TYPE,
          deletedAt: null,
          // Scope to THIS application — an id from another booking must
          // not resolve just because the token is valid for this one.
          applicationApplicant: { applicationId, deletedAt: null },
        },
        select: { storageKey: true, originalFileName: true },
      });
      if (visaDoc?.storageKey) {
        file = { storageKey: visaDoc.storageKey, fileName: visaDoc.originalFileName };
        entityType = 'Document';
      }
    }

    if (!file) {
      throw new NotFoundException('Result file not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'File no longer exists.' },
      ]);
    }
    // Validate application status allows download
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { currentStatus: true },
    });
    const allowed = ['APPROVED', 'READY_TO_DOWNLOAD'];
    if (!application || !allowed.includes(application.currentStatus as string)) {
      throw new ForbiddenException('Files not yet released', [
        {
          reason: ErrorCodes.FORBIDDEN,
          message: 'Visa files become available once the application is approved.',
        },
      ]);
    }
    const url = await this.localStorage.getSignedUrl(file.storageKey, {
      expiresIn: 60 * 60,
      contentDisposition: `attachment; filename="${file.fileName}"`,
    });
    await this.audit.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'visa.downloaded',
      // Truthful about which table the id points at, now that a
      // download can resolve to either.
      entityType,
      entityId: fileId,
      newValue: {
        applicationId,
        fileName: file.fileName,
        recipient: args.email,
      },
      ipAddress: args.ip,
      userAgent: args.userAgent,
    });
    return { url, fileName: file.fileName };
  }

  /** Returns true iff the application has at least one non-deleted primary file. */
  async hasPrimaryFile(applicationId: string): Promise<boolean> {
    const count = await this.prisma.applicationResultFile.count({
      where: { applicationId, isPrimary: true, deletedAt: null },
    });
    return count > 0;
  }

  private mapToResponse(file: any) {
    return {
      id: file.id,
      applicationId: file.applicationId,
      applicantId: file.applicantId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
      description: file.description,
      isPrimary: file.isPrimary,
      uploadedAt: file.uploadedAt,
      uploadedBy: file.uploader
        ? {
            id: file.uploader.id,
            fullName: file.uploader.fullName,
            email: file.uploader.email,
          }
        : undefined,
      applicant: file.applicant
        ? {
            id: file.applicant.id,
            applicationCode: file.applicant.applicationCode,
          }
        : undefined,
    };
  }
}
