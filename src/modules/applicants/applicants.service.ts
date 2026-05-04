import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import type {
  CreateApplicantDto,
  UpdateApplicantDto,
  UpdateApplicantStatusDto,
  UpdateApplicantEmailDto,
  IssueVisaDto,
  ApplicantResponseDto,
  ApplicantStatusHistoryEntryDto,
  DocumentResponseDto,
  IssuedVisaResponseDto,
  IssueVisaResponseDto,
} from './dto';
import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { ApplicantStatus, ApplicationStatus } from '@/common/enums';

/**
 * Multer file shape — same as documents.controller pattern. Avoids
 * pulling Express multer types into our public surface.
 */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class ApplicantsService {
  private readonly logger = new Logger(ApplicantsService.name);

  /**
   * Module 9 — issued-visa documents are stored under this key in the
   * Document.documentTypeKey column. Single canonical value so list
   * + replace + lookup all key off the same string.
   */
  static readonly ISSUED_VISA_DOC_TYPE = 'issued_visa';

  /**
   * Module 9 — max upload size for the issued visa PDF. Higher than
   * the customer-side document upload (10MB → 20MB) because consular
   * PDFs sometimes embed the photo + watermark layers.
   */
  static readonly MAX_VISA_BYTES = 20 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Generate unique application code for an applicant
   * Format: APP-YYYY-NNNNNN (e.g., APP-2026-000001)
   *
   * Application code is generated when applicant is created.
   */
  private async generateApplicationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;

    // Find the highest existing code for this year
    const lastApplicant = await this.prisma.applicationApplicant.findFirst({
      where: {
        applicationCode: {
          startsWith: prefix,
        },
      },
      orderBy: {
        applicationCode: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastApplicant?.applicationCode) {
      const lastNumber = parseInt(lastApplicant.applicationCode.replace(prefix, ''), 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  /**
   * Find all applicants for an application
   */
  async findByApplication(
    applicationId: string,
    portalIdentityId: string,
  ): Promise<ApplicantResponseDto[]> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    const applicants = await this.prisma.applicationApplicant.findMany({
      where: { applicationId, deletedAt: null },
      include: {
        documents: {
          where: { deletedAt: null },
        },
      },
      orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
    });

    return applicants.map(applicant => this.mapToResponse(applicant));
  }

  /**
   * Find applicant by ID
   */
  async findById(applicantId: string, portalIdentityId: string): Promise<ApplicantResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: {
        application: true,
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
      ]);
    }

    return this.mapToResponse(applicant);
  }

  /**
   * Find applicant by ID (admin - no ownership check)
   */
  async findByIdAdmin(applicantId: string): Promise<ApplicantResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: {
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(applicant);
  }

  /**
   * Create new applicant under an application
   *
   * Main applicant rule:
   * - Only one main applicant is allowed per application
   * - If isMainApplicant is true and a main applicant already exists, throw error
   * - First applicant can be set as main applicant
   */
  async create(
    applicationId: string,
    portalIdentityId: string,
    dto: CreateApplicantDto,
  ): Promise<ApplicantResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    // Check if application is editable (only DRAFT status)
    if (application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Applicants can only be added to draft applications',
        },
      ]);
    }

    // Check main applicant rule
    if (dto.isMainApplicant) {
      const existingMain = await this.prisma.applicationApplicant.findFirst({
        where: {
          applicationId,
          isMainApplicant: true,
          deletedAt: null,
        },
      });

      if (existingMain) {
        throw new BadRequestException('Main applicant already exists', [
          {
            reason: ErrorCodes.CONFLICT,
            message:
              'Application already has a main applicant. Only one main applicant is allowed.',
          },
        ]);
      }
    }

    // Generate unique application code
    const applicationCode = await this.generateApplicationCode();

    const applicant = await this.prisma.applicationApplicant.create({
      data: {
        applicationId,
        isMainApplicant: dto.isMainApplicant ?? false,
        email: dto.email,
        phone: dto.phone,
        formDataJson: dto.formDataJson,
        status: ApplicantStatus.DRAFT,
        applicationCode,
      },
      include: {
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    // Create initial status history
    await this.prisma.applicantStatusHistory.create({
      data: {
        applicationApplicantId: applicant.id,
        oldStatus: ApplicantStatus.DRAFT,
        newStatus: ApplicantStatus.DRAFT,
        note: 'Applicant created',
        changedBySystem: true,
      },
    });

    this.logger.log(`Applicant created: ${applicant.id} with code: ${applicationCode}`);
    return this.mapToResponse(applicant);
  }

  /**
   * Update applicant
   */
  async update(
    applicantId: string,
    portalIdentityId: string,
    dto: UpdateApplicantDto,
  ): Promise<ApplicantResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: { application: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
      ]);
    }

    // Check if application is editable (only DRAFT status)
    if (applicant.application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Applicants can only be updated in draft applications',
        },
      ]);
    }

    // Check main applicant rule if trying to set as main
    if (dto.isMainApplicant && !applicant.isMainApplicant) {
      const existingMain = await this.prisma.applicationApplicant.findFirst({
        where: {
          applicationId: applicant.applicationId,
          isMainApplicant: true,
          deletedAt: null,
          id: { not: applicantId },
        },
      });

      if (existingMain) {
        throw new BadRequestException('Main applicant already exists', [
          {
            reason: ErrorCodes.CONFLICT,
            message:
              'Application already has a main applicant. Only one main applicant is allowed.',
          },
        ]);
      }
    }

    const updatedApplicant = await this.prisma.applicationApplicant.update({
      where: { id: applicantId },
      data: {
        ...(dto.isMainApplicant !== undefined && {
          isMainApplicant: dto.isMainApplicant,
        }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.formDataJson !== undefined && { formDataJson: dto.formDataJson }),
      },
      include: {
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    this.logger.log(`Applicant updated: ${applicantId}`);
    return this.mapToResponse(updatedApplicant);
  }

  /**
   * Soft delete applicant
   */
  async delete(applicantId: string, portalIdentityId: string): Promise<void> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: { application: true },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
      ]);
    }

    // Check if application is editable (only DRAFT status)
    if (applicant.application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Applicants can only be deleted from draft applications',
        },
      ]);
    }

    await this.prisma.applicationApplicant.update({
      where: { id: applicantId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Applicant soft deleted: ${applicantId}`);
  }

  /**
   * Update applicant status (admin only).
   *
   * Module 9 changes:
   *   • Sets `statusUpdatedAt` + `statusUpdatedByUserId` denormalized
   *     pointers on the row so list views can render "READY (admin@x,
   *     5m ago)" without joining the history table.
   *   • Emits `applicant.status.update` audit entry alongside the
   *     existing status-history row (history = customer-visible
   *     timeline; audit = forensic compliance log; both kept in sync).
   *   • No-op short-circuit when the requested status equals the
   *     current status — saves a needless audit + history row.
   */
  async updateStatus(
    applicantId: string,
    userId: string,
    dto: UpdateApplicantStatusDto,
  ): Promise<ApplicantResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    const oldStatus = applicant.status;
    if (oldStatus === dto.status) {
      // No-op — return current state without writing history/audit.
      return this.mapToResponse({ ...applicant, documents: [] });
    }

    const now = new Date();

    const [updatedApplicant] = await this.prisma.$transaction([
      this.prisma.applicationApplicant.update({
        where: { id: applicantId },
        data: {
          status: dto.status,
          statusUpdatedAt: now,
          statusUpdatedByUserId: userId,
        },
        include: {
          documents: {
            where: { deletedAt: null },
          },
        },
      }),
      this.prisma.applicantStatusHistory.create({
        data: {
          applicationApplicantId: applicantId,
          oldStatus,
          newStatus: dto.status,
          note: dto.note,
          changedByUserId: userId,
          changedBySystem: false,
        },
      }),
    ]);

    await this.auditLogsService.logAdminAction(
      userId,
      'applicant.status.update',
      'ApplicationApplicant',
      applicantId,
      { status: oldStatus },
      { status: dto.status, note: dto.note },
    );

    this.logger.log(`Applicant status updated: ${applicantId} from ${oldStatus} to ${dto.status}`);
    return this.mapToResponse(updatedApplicant);
  }

  /**
   * Module 9 — admin updates applicant email (typo correction).
   * The audit entry captures old + new + reason so customer support
   * can later see exactly when/why the address changed.
   */
  async updateEmail(
    applicantId: string,
    userId: string,
    dto: UpdateApplicantEmailDto,
  ): Promise<ApplicantResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      include: { documents: { where: { deletedAt: null } } },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    const newEmail = dto.email.trim().toLowerCase();
    if (applicant.email.toLowerCase() === newEmail) {
      return this.mapToResponse(applicant);
    }

    const updated = await this.prisma.applicationApplicant.update({
      where: { id: applicantId },
      data: { email: newEmail },
      include: { documents: { where: { deletedAt: null } } },
    });

    await this.auditLogsService.logAdminAction(
      userId,
      'applicant.email.update',
      'ApplicationApplicant',
      applicantId,
      { email: applicant.email },
      { email: newEmail, reason: dto.reason ?? null },
    );

    this.logger.log(
      `Applicant email updated: ${applicantId} (${applicant.email} → ${newEmail})`,
    );
    return this.mapToResponse(updated);
  }

  /**
   * Module 9 — admin reads the full status timeline for one applicant.
   * Joined with the actor user so the table can render the admin's
   * name without a second fetch.
   */
  async getStatusHistory(
    applicantId: string,
  ): Promise<ApplicantStatusHistoryEntryDto[]> {
    // Confirm the applicant exists so we 404 cleanly rather than
    // returning an empty array on a typo'd id.
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, deletedAt: null },
      select: { id: true },
    });
    if (!applicant) {
      throw new NotFoundException('Applicant not found', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or has been deleted',
        },
      ]);
    }

    const rows = await this.prisma.applicantStatusHistory.findMany({
      where: { applicationApplicantId: applicantId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      oldStatus: r.oldStatus,
      newStatus: r.newStatus,
      note: r.note ?? undefined,
      changedBySystem: r.changedBySystem,
      changedByUserId: r.changedByUserId ?? undefined,
      changedByUser: r.changedByUser
        ? {
            id: r.changedByUser.id,
            fullName: r.changedByUser.fullName,
            email: r.changedByUser.email,
          }
        : undefined,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Module 9 — admin uploads the issued visa PDF for one applicant.
   *
   * Flow:
   *   1. Validate file (PDF only, ≤20MB).
   *   2. Validate parent application is APPROVED.
   *   3. Validate applicant belongs to the application + isn't deleted.
   *   4. If a prior issued_visa Document exists for this applicant, soft-
   *      delete it and remember we replaced (audit metadata).
   *   5. Upload to storage at `visas/{applicationCode}/{applicantCode}.pdf`.
   *   6. Create the new Document row + flip applicant status →
   *      READY_TO_DOWNLOAD inside one transaction.
   *   7. After commit: count active applicants on the application; if
   *      ALL of them are READY_TO_DOWNLOAD, transition the application
   *      itself + write status-history row + queue ready_to_download
   *      email. Done outside the transaction so a slow email send
   *      doesn't hold a DB lock.
   *   8. Audit `application.issue_visa` with full metadata.
   */
  async issueVisa(
    applicationId: string,
    applicantId: string,
    userId: string,
    file: MulterFile,
    dto: IssueVisaDto,
  ): Promise<IssueVisaResponseDto> {
    if (!file) {
      throw new BadRequestException('PDF file is required', [
        { reason: ErrorCodes.VALIDATION_ERROR, message: 'No file uploaded' },
      ]);
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are accepted', [
        {
          field: 'file',
          reason: ErrorCodes.VALIDATION_ERROR,
          message: `Got ${file.mimetype}; expected application/pdf`,
        },
      ]);
    }
    if (file.size > ApplicantsService.MAX_VISA_BYTES) {
      throw new BadRequestException('File too large', [
        {
          field: 'file',
          reason: ErrorCodes.VALIDATION_ERROR,
          message: `Visa PDFs are capped at 20MB; got ${(file.size / 1024 / 1024).toFixed(1)}MB`,
        },
      ]);
    }

    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, applicationId, deletedAt: null },
      include: {
        application: { select: { id: true, currentStatus: true } },
      },
    });

    if (!applicant) {
      throw new NotFoundException('Applicant not found on this application', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist, was deleted, or belongs to a different application',
        },
      ]);
    }

    // Status guard: visa issuance only valid when application is APPROVED.
    // Once the application transitions to READY_TO_DOWNLOAD we still
    // permit re-issue (admin needs to fix a wrong PDF) — handled by
    // including READY_TO_DOWNLOAD in the allowed set.
    const allowedStatuses: string[] = [
      ApplicationStatus.APPROVED,
      ApplicationStatus.READY_TO_DOWNLOAD,
    ];
    if (!allowedStatuses.includes(applicant.application.currentStatus)) {
      throw new ConflictException('Application is not in an issue-able state', [
        {
          field: 'applicationId',
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Application status is ${applicant.application.currentStatus}; visa issuance requires APPROVED.`,
        },
      ]);
    }

    // Detect any existing issued visa for this applicant (replace path).
    const existingVisa = await this.prisma.document.findFirst({
      where: {
        applicationApplicantId: applicantId,
        documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
        deletedAt: null,
      },
    });

    // Storage key — use applicationCode if available (admin-friendly
    // listing in S3) but fall back to ids so first-issue case still
    // works before the code is set.
    const codePart = applicant.applicationCode ?? `app-${applicationId}`;
    const prefix = `visas/${codePart}`;

    const uploadResult = await this.storageService.upload(file.buffer, {
      contentType: file.mimetype,
      prefix,
      originalFilename: file.originalname,
      metadata: {
        applicantId,
        applicationId,
        documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
        issuedByUserId: userId,
        referenceNumber: dto.referenceNumber ?? '',
      },
    });

    // Compute checksum of the buffer (server-side fallback when the
    // storage layer doesn't return one). Same SHA-256 the storage
    // provider uses internally — kept consistent so verifyChecksum
    // stays meaningful.
    const checksum =
      uploadResult.checksum ??
      crypto.createHash('sha256').update(file.buffer).digest('hex');

    const now = new Date();

    // Atomic: soft-delete prior visa, create new Document, flip applicant
    // status, write per-applicant history. Application-level transition
    // happens after the commit (needs to count siblings).
    const [, newDoc] = await this.prisma.$transaction([
      // Soft-delete prior visa (if any)
      this.prisma.document.updateMany({
        where: existingVisa ? { id: existingVisa.id } : { id: '__none__' },
        data: { deletedAt: now },
      }),
      this.prisma.document.create({
        data: {
          applicationApplicantId: applicantId,
          documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
          originalFileName: file.originalname,
          storageFileName: uploadResult.filename,
          storagePath: prefix,
          storageKey: uploadResult.storageKey,
          storageProvider: this.storageService.getProviderName(),
          mimeType: file.mimetype,
          fileSize: uploadResult.size,
          checksum,
          // Issued visas don't go through review.
          reviewStatus: 'APPROVED',
          reviewedByUserId: userId,
          reviewedAt: now,
          reviewNote: dto.notes ?? null,
        },
      }),
      this.prisma.applicationApplicant.update({
        where: { id: applicantId },
        data: {
          status: ApplicantStatus.READY_TO_DOWNLOAD,
          statusUpdatedAt: now,
          statusUpdatedByUserId: userId,
        },
      }),
      this.prisma.applicantStatusHistory.create({
        data: {
          applicationApplicantId: applicantId,
          oldStatus: applicant.status,
          newStatus: ApplicantStatus.READY_TO_DOWNLOAD,
          note: existingVisa ? 'Visa re-issued (replaced previous PDF)' : 'Visa issued',
          changedByUserId: userId,
          changedBySystem: false,
        },
      }),
    ]);

    // Application-level transition: if every active applicant on this
    // app now has an issued_visa document, flip the parent.
    const applicationStatus = await this.maybeTransitionApplicationToReady(
      applicationId,
      userId,
    );

    // Audit logged AFTER the writes succeed so we never claim a write
    // that didn't land.
    await this.auditLogsService.logAdminAction(
      userId,
      'application.issue_visa',
      'ApplicationApplicant',
      applicantId,
      existingVisa
        ? {
            previousDocumentId: existingVisa.id,
            previousFileName: existingVisa.originalFileName,
            previousFileSize: existingVisa.fileSize,
          }
        : undefined,
      {
        applicationId,
        documentId: newDoc.id,
        fileName: file.originalname,
        fileSize: uploadResult.size,
        referenceNumber: dto.referenceNumber ?? null,
        notes: dto.notes ?? null,
        replaced: !!existingVisa,
      },
    );

    return {
      documentId: newDoc.id,
      applicantId,
      applicantStatus: ApplicantStatus.READY_TO_DOWNLOAD,
      applicationStatus,
      allApplicantsIssued: applicationStatus === ApplicationStatus.READY_TO_DOWNLOAD,
      replaced: !!existingVisa,
    };
  }

  /**
   * Transition the parent application to READY_TO_DOWNLOAD when every
   * active applicant has an issued_visa document. Idempotent — when
   * already in that state, returns the current status without
   * re-emitting history. Returns the final application status for the
   * issue-visa response.
   */
  private async maybeTransitionApplicationToReady(
    applicationId: string,
    userId: string,
  ): Promise<string> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicants: {
          where: { deletedAt: null },
          include: {
            documents: {
              where: {
                documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
                deletedAt: null,
              },
              select: { id: true },
            },
          },
        },
        portalIdentity: { select: { email: true } },
      },
    });
    if (!app) return 'UNKNOWN';

    const allIssued =
      app.applicants.length > 0 &&
      app.applicants.every((a) => a.documents.length > 0);

    if (!allIssued) return app.currentStatus;
    if (app.currentStatus === ApplicationStatus.READY_TO_DOWNLOAD) {
      return ApplicationStatus.READY_TO_DOWNLOAD;
    }

    const oldStatus = app.currentStatus;
    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: { currentStatus: ApplicationStatus.READY_TO_DOWNLOAD },
      }),
      this.prisma.applicationStatusHistory.create({
        data: {
          applicationId,
          oldStatus,
          newStatus: ApplicationStatus.READY_TO_DOWNLOAD,
          note: 'All applicants have issued visas',
          changedByUserId: userId,
          changedBySystem: false,
        },
      }),
    ]);

    // Send the customer notification email — fire-and-forget; an SMTP
    // hiccup shouldn't fail the issuance request.
    if (app.portalIdentity?.email) {
      const applicationRef = app.applicants[0]?.applicationCode ?? applicationId.slice(0, 8).toUpperCase();
      this.emailService
        .sendTemplatedEmail({
          to: app.portalIdentity.email,
          templateKey: 'application.ready_to_download',
          variables: {
            applicationRef,
            customerName: app.applicants[0]?.email ?? 'Applicant',
          },
          relatedEntity: 'Application',
          relatedEntityId: applicationId,
        })
        .catch((err) =>
          this.logger.error(
            `Failed to send ready_to_download email for app ${applicationId}: ${err}`,
          ),
        );
    }

    return ApplicationStatus.READY_TO_DOWNLOAD;
  }

  /**
   * Module 9 — admin reads the issued-visa metadata (without the file
   * bytes) for the Operations Center "Issue Visa" widget. 404 when no
   * visa has been issued yet.
   */
  async getIssuedVisa(
    applicationId: string,
    applicantId: string,
  ): Promise<IssuedVisaResponseDto> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, applicationId, deletedAt: null },
      select: { id: true },
    });
    if (!applicant) {
      throw new NotFoundException('Applicant not found on this application', [
        {
          reason: ErrorCodes.APPLICANT_NOT_FOUND,
          message: 'Applicant does not exist or belongs to a different application',
        },
      ]);
    }

    const doc = await this.prisma.document.findFirst({
      where: {
        applicationApplicantId: applicantId,
        documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!doc) {
      throw new NotFoundException('No visa issued for this applicant yet', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'No issued visa document exists for this applicant',
        },
      ]);
    }

    // Reference number was stored in storage metadata; we keep it on
    // the audit log + storage layer rather than a dedicated column to
    // avoid schema sprawl. Surface it back from review note for now;
    // future iteration could add a `referenceNumber` column on
    // Document if it becomes a frequently-queried field.
    return {
      documentId: doc.id,
      originalFileName: doc.originalFileName,
      fileSize: doc.fileSize,
      checksum: doc.checksum ?? undefined,
      issuedAt: doc.createdAt,
      issuedByUserId: doc.reviewedByUserId ?? undefined,
      notes: doc.reviewNote ?? undefined,
    };
  }

  /**
   * Module 9 — customer download. Validates the portal session owns
   * the application before streaming. Audit emits portal-side action
   * `application.visa_downloaded` with metadata so admins can later
   * see "customer X downloaded their visa from IP Y on Z".
   */
  async downloadVisaForPortal(
    applicationId: string,
    applicantId: string,
    portalIdentityId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string; documentId: string }> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, applicationId, deletedAt: null },
      include: {
        application: { select: { portalIdentityId: true } },
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

    const doc = await this.prisma.document.findFirst({
      where: {
        applicationApplicantId: applicantId,
        documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc || !doc.storageKey) {
      throw new NotFoundException('Visa not issued yet', [
        { reason: ErrorCodes.NOT_FOUND, message: 'No visa has been issued for this applicant' },
      ]);
    }

    const dl = await this.storageService.download(doc.storageKey);

    const codePart = applicant.applicationCode ?? `application-${applicationId.slice(0, 8)}`;
    const filename = `visa-${codePart}.pdf`;

    // Audit the customer-side download with PORTAL_IDENTITY actor so
    // the audit feed clearly distinguishes admin vs customer actions.
    await this.auditLogsService.create({
      actorType: 'PORTAL_IDENTITY' as any,
      actionKey: 'application.visa_downloaded',
      entityType: 'Document',
      entityId: doc.id,
      newValue: {
        applicantId,
        applicationId,
        applicationCode: applicant.applicationCode,
        documentId: doc.id,
        filename,
      },
      ipAddress: ip,
      userAgent,
    });

    return {
      buffer: dl.buffer,
      contentType: dl.contentType ?? 'application/pdf',
      filename,
      documentId: doc.id,
    };
  }

  /**
   * Module 9 — same auth check as downloadVisaForPortal but returns
   * a signed URL (storage-provider native or local-fallback) with
   * 24h expiry. Useful for big PDFs where streaming through Nest is
   * wasteful.
   */
  async getVisaSignedUrlForPortal(
    applicationId: string,
    applicantId: string,
    portalIdentityId: string,
  ): Promise<{ url: string; expiresAt: Date }> {
    const applicant = await this.prisma.applicationApplicant.findFirst({
      where: { id: applicantId, applicationId, deletedAt: null },
      include: { application: { select: { portalIdentityId: true } } },
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

    const doc = await this.prisma.document.findFirst({
      where: {
        applicationApplicantId: applicantId,
        documentTypeKey: ApplicantsService.ISSUED_VISA_DOC_TYPE,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!doc || !doc.storageKey) {
      throw new NotFoundException('Visa not issued yet', [
        { reason: ErrorCodes.NOT_FOUND, message: 'No visa has been issued for this applicant' },
      ]);
    }

    const expiresInSeconds = 24 * 60 * 60;
    const url = await this.storageService.getSignedUrl(doc.storageKey, {
      expiresIn: expiresInSeconds,
    });
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    return { url, expiresAt };
  }

  private mapToResponse(applicant: any): ApplicantResponseDto {
    const documents: DocumentResponseDto[] | undefined = applicant.documents?.map((doc: any) => ({
      id: doc.id,
      documentTypeKey: doc.documentTypeKey,
      originalFileName: doc.originalFileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      reviewStatus: doc.reviewStatus,
      reviewNote: doc.reviewNote || undefined,
      uploadedAt: doc.uploadedAt,
      reviewedAt: doc.reviewedAt || undefined,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return {
      id: applicant.id,
      applicationId: applicant.applicationId,
      isMainApplicant: applicant.isMainApplicant,
      email: applicant.email,
      phone: applicant.phone || undefined,
      formDataJson: applicant.formDataJson as Record<string, any>,
      status: applicant.status,
      applicationCode: applicant.applicationCode || undefined,
      resultFileName: applicant.resultFileName || undefined,
      resultStorageKey: applicant.resultStorageKey || undefined,
      requiredDocumentsJson: (applicant.requiredDocumentsJson as Record<string, any>) || undefined,
      additionalDocsRequestedJson:
        (applicant.additionalDocsRequestedJson as Record<string, any>) || undefined,
      documents,
      createdAt: applicant.createdAt,
      updatedAt: applicant.updatedAt,
    };
  }
}
