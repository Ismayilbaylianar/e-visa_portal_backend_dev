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
  async listForPortal(applicationId: string) {
    return this.listForApplication(applicationId);
  }

  async getSignedUrlForPortal(
    applicationId: string,
    fileId: string,
    args: { email: string; ip?: string; userAgent?: string },
  ) {
    const file = await this.prisma.applicationResultFile.findFirst({
      where: { id: fileId, applicationId, deletedAt: null },
    });
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
      entityType: 'ApplicationResultFile',
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
