import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { computeFeeTotals } from './application-fees';
import { ApplicationCompletenessService } from './application-completeness.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import { NotificationEmitterService } from '../notifications/notification-emitter.service';
import { SettingsService } from '../settings/settings.service';
import { PortalTokenService } from './portal-token.service';
import { PaymentsService } from '../payments/payments.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  UpdateEstimatedTimeDto,
  EstimatedTimeChangeEntryDto,
  ChangeApplicationStatusDto,
  AcceptApplicationDto,
  CancelApplicationDto,
} from './dto';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  BaseException,
} from '@/common/exceptions';
import { HttpStatus } from '@nestjs/common';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import { ApplicationStatus, PaymentStatus } from '@/common/enums';
import { ActorType } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly emailService: EmailService,
    private readonly notificationEmitter: NotificationEmitterService,
    // M11.8 (ISSUE 8) — needed by sendStatusNotificationEmail to
    // build the {{ctaUrl}} variable from FRONTEND_URL.
    private readonly configService: ConfigService,
    // M11.10 — read maintenance toggle to block create() when ON.
    private readonly settingsService: SettingsService,
    // M11.13 (BUG U + T) — mint signed deep-link tokens so status
    // emails carry per-recipient one-click access to /portal/[code].
    private readonly portalToken: PortalTokenService,
    // Required-field validation, shared with PaymentsService.
    private readonly completeness: ApplicationCompletenessService,
    // Stage 3 — the first decision captures or releases the customer's
    // held funds, so the application flow owns the payment trigger.
    private readonly paymentsService: PaymentsService,
  ) {}

  private generateResumeToken(): string {
    return randomBytes(32).toString('hex');
  }

  async findAll(
    query: GetApplicationsQueryDto,
  ): Promise<{ items: ApplicationResponseDto[]; pagination: PaginationMeta }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      paymentStatus,
      destinationCountryId,
      visaTypeId,
      dateFrom,
      dateTo,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { currentStatus: status }),
      ...(paymentStatus && { paymentStatus }),
      ...(destinationCountryId && { destinationCountryId }),
      ...(visaTypeId && { visaTypeId }),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: {
          portalIdentity: true,
          nationalityCountry: true,
          destinationCountry: true,
          visaType: true,
          visaTypeEntry: true,
          template: true,
          applicants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.application.count({ where }),
    ]);

    const items = applications.map(app => this.mapToResponse(app));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<ApplicationResponseDto> {
    // M11.14 (BUG QQ) — Previously this method used a hand-rolled
    // `include` that omitted `assignedToUser` / `assignedByUser`. The
    // POST /assign endpoint USES `getApplicationIncludes()` (which
    // DOES include them) and its response shows the assignment
    // correctly — but the very next GET on the same row went through
    // findById, hit the lean include, and surfaced `assignedToUser:
    // null` even though `assigned_to` was set in DB. Frontend looked
    // like a silent failure. Switch to the shared include helper so
    // there's one source of truth, then layer the per-applicant
    // documents extension on top (only this code path needs that —
    // the helper omits it because it'd over-fetch on list views).
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...this.getApplicationIncludes(),
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' as const }, { createdAt: 'asc' as const }],
          include: {
            // M11.8 (ISSUE 7) — admin + portal detail pages render
            // an Applicants → Documents section. Without this include
            // the response had `documents: []` even when uploads
            // existed in the documents table, so admins saw nothing.
            documents: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: 'desc' as const },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(application);
  }

  async findByIdForPortal(id: string, portalIdentityId: string): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        // BUG (mock-pay + frozen-timer) — the customer payment page reads
        // `application.payments[]` to resolve the pending paymentId (so the
        // mock confirm step runs → PAID flip) and the `expiresAt` deadline
        // (so the countdown ticks). This was the missing data. Scoped to
        // the portal getApplication path; latest row first.
        payments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          include: {
            // M11.8 (ISSUE 7) — admin + portal detail pages render
            // an Applicants → Documents section. Without this include
            // the response had `documents: []` even when uploads
            // existed in the documents table, so admins saw nothing.
            documents: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    // Check ownership
    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    return this.mapToResponse(application);
  }

  async create(
    dto: CreateApplicationDto,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    // M11.10 — Maintenance-mode guard. When the admin has toggled
    // maintenance_mode ON in /admin/settings, customers see a
    // pre-form maintenance screen on /apply (frontend gate). This
    // guard is defence-in-depth: if a stale tab or a direct API
    // caller tries to POST anyway, we reject with 503 so the
    // operator's intent ("don't accept new applications right now")
    // is preserved end-to-end. Existing applications + payments are
    // unaffected — only fresh `create` is blocked.
    const maintenance = await this.settingsService.getMaintenanceState();
    if (maintenance.enabled) {
      throw new ServiceUnavailableException(
        maintenance.message ||
          'New applications are temporarily unavailable. Please try again shortly.',
        [
          {
            reason: 'maintenance_mode',
            message:
              maintenance.message ||
              'We are temporarily not accepting new applications. Please try again later.',
          },
        ],
      );
    }

    const now = new Date();

    // Find active binding with date validity check
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        id: dto.templateBindingId,
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        isActive: true,
        deletedAt: null,
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      },
      include: {
        template: true,
        // Entries feature (Stage 4) — pricing is per (nationality, entry).
        // When the customer's chosen entry is supplied, match the exact
        // (nationality, entry) fee so the recorded total is that entry's
        // price (not an arbitrary first entry).
        nationalityFees: {
          where: {
            nationalityCountryId: dto.nationalityCountryId,
            ...(dto.visaTypeEntryId ? { entryId: dto.visaTypeEntryId } : {}),
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    if (!templateBinding) {
      throw new NotFoundException('No valid binding found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'No active template binding found for this combination',
        },
      ]);
    }

    // Check validTo date
    if (templateBinding.validTo && templateBinding.validTo < now) {
      throw new NotFoundException('Binding has expired', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'The template binding is no longer valid',
        },
      ]);
    }

    const nationalityFee = templateBinding.nationalityFees[0];
    if (!nationalityFee) {
      throw new NotFoundException('No fee configuration found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'No fee configuration found for this nationality',
        },
      ]);
    }

    // Per-applicant pricing. No applicant exists yet at create time, so
    // this is the one-person quote; `recalculateTotalFee` re-derives it
    // every time an applicant is added or removed, and payment creation
    // recomputes it again from the real head count.
    const totalFeeAmount = computeFeeTotals(nationalityFee, 1, !!dto.expedited).totalAmount;

    // M11.10 (BUG 4) — Generate booking-level reference code
    // (REF-YYYY-NNNNNN). Same defensive pattern as the M11.6
    // applicationCode generator: scan recent rows for the year,
    // pick numeric-only suffixes, take max+1, retry on P2002.
    const application = await this.withReferenceCodeRetry((referenceCode) =>
      this.prisma.application.create({
        data: {
          referenceCode,
          portalIdentityId,
          nationalityCountryId: dto.nationalityCountryId,
          destinationCountryId: dto.destinationCountryId,
          visaTypeId: dto.visaTypeId,
          // Entries feature (Stage 4) — record the customer's chosen entry.
          ...(dto.visaTypeEntryId ? { visaTypeEntryId: dto.visaTypeEntryId } : {}),
          templateId: templateBinding.templateId,
          templateBindingId: templateBinding.id,
          totalFeeAmount,
          currencyCode: nationalityFee.currencyCode,
          expedited: dto.expedited ?? false,
          paymentStatus: PaymentStatus.PENDING,
          currentStatus: ApplicationStatus.DRAFT,
          resumeToken: this.generateResumeToken(),
        },
        include: {
          portalIdentity: true,
          nationalityCountry: true,
          destinationCountry: true,
          visaType: true,
          visaTypeEntry: true,
          template: true,
          applicants: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
    );

    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        oldStatus: ApplicationStatus.DRAFT,
        newStatus: ApplicationStatus.DRAFT,
        note: 'Application created',
        changedBySystem: true,
      },
    });

    // Audit log for application creation
    await this.auditLogsService.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'application.create',
      entityType: 'Application',
      entityId: application.id,
      newValue: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        nationalityCountryId: dto.nationalityCountryId,
        expedited: dto.expedited,
        totalFeeAmount,
      },
    });

    this.logger.log(`Application created: ${application.id}`);
    return this.mapToResponse(application);
  }

  async update(
    id: string,
    dto: UpdateApplicationDto,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        templateBinding: {
          include: {
            nationalityFees: {
              where: { isActive: true, deletedAt: null },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    // Check ownership
    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    // Check if editable (only DRAFT status)
    if (application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application is not editable', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Only draft applications can be updated',
        },
      ]);
    }

    let totalFeeAmount = Number(application.totalFeeAmount);

    if (dto.expedited !== undefined && dto.expedited !== application.expedited) {
      const nationalityFee = application.templateBinding.nationalityFees.find(
        fee => fee.nationalityCountryId === application.nationalityCountryId,
      );

      if (nationalityFee) {
        // Toggling express re-prices the whole booking, so multiply by
        // the current head count rather than quoting one person.
        const count = await this.prisma.applicationApplicant.count({
          where: { applicationId: id, deletedAt: null },
        });
        totalFeeAmount = computeFeeTotals(
          nationalityFee,
          count,
          !!dto.expedited,
        ).totalAmount;
      }
    }

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        ...(dto.expedited !== undefined && { expedited: dto.expedited }),
        totalFeeAmount,
      },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    this.logger.log(`Application updated: ${id}`);
    return this.mapToResponse(updatedApplication);
  }

  async submitForReview(id: string, portalIdentityId: string): Promise<ApplicationResponseDto> {
    // M11.10 — same maintenance guard as create(). Customer who
    // started a draft BEFORE the toggle won't be able to push it
    // through to SUBMITTED while maintenance is on. Their data is
    // preserved as DRAFT and they can resume after toggle-off.
    const maintenance = await this.settingsService.getMaintenanceState();
    if (maintenance.enabled) {
      throw new ServiceUnavailableException(
        maintenance.message || 'New submissions are temporarily unavailable.',
        [
          {
            reason: 'maintenance_mode',
            message:
              maintenance.message ||
              'We are temporarily not accepting new submissions. Your draft is saved.',
          },
        ],
      );
    }
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        applicants: {
          where: { deletedAt: null },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    // Check ownership
    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    if (application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException('Application cannot be submitted for review', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Only draft applications can be submitted for review',
        },
      ]);
    }

    if (application.applicants.length === 0) {
      throw new BadRequestException('At least one applicant required', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Application must have at least one applicant before submitting',
        },
      ]);
    }

    // Required-field validation lives HERE, on the submit gate, not in
    // the browser. Until 2026-08-22 it was client-side only, so an
    // applicant with a single field could be pushed through the API,
    // burn a reference code and become payable.
    await this.completeness.assertComplete(id);

    // Head count may have changed since the last quote; make sure the
    // stored total matches before the application becomes payable.
    await this.recalculateTotalFee(id);

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.UNPAID;

    // Stage 3 Step 5 — the payment window comes from the admin setting
    // (default 3h). The payment row's own `expiresAt` is derived from
    // this deadline, and the timeout sweep enforces it, so this is the
    // single place the duration is decided.
    const timeoutHours = await this.settingsService.getPaymentTimeoutHours();

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        paymentDeadlineAt: new Date(Date.now() + timeoutHours * 60 * 60 * 1000),
      },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: 'Application submitted for review, awaiting payment',
        changedBySystem: true,
      },
    });

    // Audit log for status change
    await this.auditLogsService.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'application.status_change',
      entityType: 'Application',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, action: 'submit_for_review' },
    });

    // M11.11 (BUG G) — Customer "application received" email. Fires
    // at the DRAFT → UNPAID transition (i.e. user has finished
    // filling the form and clicked Submit, payment still pending).
    // The follow-up `payment.success` email lands separately when
    // payment clears (M11.10 BUG 3 wiring).
    void this.sendApplicationCreatedEmail(updatedApplication);

    this.logger.log(`Application submitted for review: ${id}`);
    return this.mapToResponse(updatedApplication);
  }

  /**
   * M11.11 (BUG G) — Send the `application.created` template to
   * portal email + every applicant email (case-insensitive dedup).
   * Same shape as M11.10 BUG 3's payment.success email — variables
   * cover {{fullName}}, {{applicationCode}}, {{referenceCode}},
   * {{destinationCountry}}, {{visaType}}, {{totalAmount}},
   * {{currencyCode}}, {{ctaUrl}}.
   *
   * Per-recipient `notification.email_sent` audit row written so
   * the audit timeline shows exactly what fired.
   */
  private async sendApplicationCreatedEmail(application: any): Promise<void> {
    try {
      const main =
        application.applicants?.find((a: any) => a.isMainApplicant) ??
        application.applicants?.[0];
      const applicationCode = main?.applicationCode;
      if (!applicationCode) {
        this.logger.warn(
          `[BUG G] No applicationCode for application ${application.id}; skipping created email`,
        );
        return;
      }

      const fullName = (() => {
        const data = (main?.formDataJson ?? {}) as Record<string, unknown>;
        const fn = String(data.firstName ?? '').trim();
        const ln = String(data.lastName ?? '').trim();
        return [fn, ln].filter(Boolean).join(' ') || 'Applicant';
      })();

      const baseUrl = (
        this.configService.get<string>('FRONTEND_URL') ??
        this.configService.get<string>('PUBLIC_BASE_URL') ??
        'https://evisaglobal.com'
      ).replace(/\/+$/, '');

      const recipients = new Set<string>();
      if (application.portalIdentity?.email) {
        recipients.add(application.portalIdentity.email.toLowerCase().trim());
      }
      for (const ap of application.applicants ?? []) {
        if (ap.email) recipients.add(ap.email.toLowerCase().trim());
      }
      if (recipients.size === 0) return;

      const variables = {
        fullName,
        applicationCode,
        referenceCode: application.referenceCode ?? '',
        applicationStatus: 'Pending Payment',
        destinationCountry: application.destinationCountry?.name ?? '',
        visaType: application.visaType?.label ?? '',
        totalAmount: application.totalFeeAmount?.toString() ?? '',
        currencyCode: application.currencyCode ?? '',
        // CTA: /track lets the customer follow status. Once the
        // payment-page builder is wired into a real flow, swap to
        // the payment URL when status is UNPAID.
        ctaUrl: `${baseUrl}/track`,
      };

      for (const recipient of recipients) {
        try {
          const result = await this.emailService.sendTemplatedEmail({
            to: recipient,
            templateKey: 'application.created',
            variables,
            relatedEntity: 'Application',
            relatedEntityId: application.id,
          });
          await this.auditLogsService.logSystemAction(
            'notification.email_sent',
            'Application',
            application.id,
            undefined,
            {
              recipient,
              templateKey: 'application.created',
              applicationCode,
              referenceCode: application.referenceCode ?? null,
              success: result.success,
              messageId: result.messageId ?? null,
              error: result.error ?? null,
            },
          );
          this.logger.log(
            `[BUG G] application.created → ${recipient} (${applicationCode}) ${result.success ? 'ok' : 'fail'}`,
          );
        } catch (err) {
          this.logger.error(
            `[BUG G] Failed application.created to ${recipient}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[BUG G] sendApplicationCreatedEmail outer error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Submit application for processing
   *
   * Current stage behavior:
   * - Payment is not implemented yet, so we allow submission from UNPAID status
   * - In production, this should require PaymentStatus.PAID
   * - This is a temporary behavior documented in README
   */
  async submit(id: string, portalIdentityId: string): Promise<ApplicationResponseDto> {
    // M11.10 — maintenance guard (defence-in-depth, see submitForReview).
    const maintenance = await this.settingsService.getMaintenanceState();
    if (maintenance.enabled) {
      throw new ServiceUnavailableException(
        maintenance.message || 'New submissions are temporarily unavailable.',
        [
          {
            reason: 'maintenance_mode',
            message:
              maintenance.message ||
              'We are temporarily not accepting new submissions. Your draft is saved.',
          },
        ],
      );
    }
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        applicants: {
          where: { deletedAt: null },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    // Check ownership
    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    // Check at least one applicant
    if (application.applicants.length === 0) {
      throw new BadRequestException('At least one applicant required', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Application must have at least one applicant before submitting',
        },
      ]);
    }

    // Required-field validation lives HERE, on the submit gate, not in
    // the browser. Until 2026-08-22 it was client-side only, so an
    // applicant with a single field could be pushed through the API,
    // burn a reference code and become payable.
    await this.completeness.assertComplete(id);

    // Head count may have changed since the last quote; make sure the
    // stored total matches before the application becomes payable.
    await this.recalculateTotalFee(id);

    const allowedStatuses: ApplicationStatus[] = [
      ApplicationStatus.UNPAID,
      ApplicationStatus.DRAFT,
    ];
    if (!allowedStatuses.includes(application.currentStatus as ApplicationStatus)) {
      throw new BadRequestException('Application cannot be submitted', [
        {
          reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
          message: 'Application is not in a submittable state',
        },
      ]);
    }

    // Stage 3 — payment gate. Reaching SUBMITTED means "the customer has
    // paid and the operator owes them a decision", so it now requires a
    // payment with funds held (AUTHORIZED) or already captured (PAID).
    // Previously this endpoint moved any UNPAID/DRAFT application straight
    // to SUBMITTED with no payment at all, which bypassed the whole
    // payment flow. DRAFT→UNPAID (submitForReview) is unaffected.
    const settledPayment = await this.prisma.payment.findFirst({
      where: {
        applicationId: id,
        deletedAt: null,
        paymentStatus: { in: [PaymentStatus.AUTHORIZED, PaymentStatus.PAID] },
      },
      select: { id: true },
    });
    if (!settledPayment) {
      throw new BadRequestException('Payment required before submission', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'This application has no authorized or captured payment. Complete payment to submit it.',
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.SUBMITTED;

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
      },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: 'Application submitted for processing',
        changedBySystem: true,
      },
    });

    // Audit log for final submission
    await this.auditLogsService.create({
      actorType: ActorType.PORTAL_IDENTITY,
      actionKey: 'application.submit',
      entityType: 'Application',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus, applicantCount: application.applicants.length },
    });

    this.logger.log(`Application submitted: ${id}`);

    // M11.5 — surface to the Activity Telegram channel + admin feed.
    void this.notificationEmitter.emit('app.submitted', {
      applicationId: id,
      applicationCode: updatedApplication.applicants[0]?.applicationCode,
      email: updatedApplication.portalIdentity?.email,
      destinationName: updatedApplication.destinationCountry?.name,
      visaTypeName: updatedApplication.visaType?.label,
      applicantCount: updatedApplication.applicants.length,
      totalAmount: updatedApplication.totalFeeAmount?.toString?.() ?? null,
      currency: updatedApplication.currencyCode,
    });

    return this.mapToResponse(updatedApplication);
  }

  /**
   * Get application by resume token
   * Used to resume an incomplete application
   */
  async getByResumeToken(
    resumeToken: string,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { resumeToken, deletedAt: null },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          include: {
            // M11.8 (ISSUE 7) — admin + portal detail pages render
            // an Applicants → Documents section. Without this include
            // the response had `documents: []` even when uploads
            // existed in the documents table, so admins saw nothing.
            documents: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!application) {
      // Distinguish "cancelled by the payment-timeout sweep" from
      // "never existed". A second lookup WITHOUT the deletedAt filter,
      // scoped to the same token, checks only for the timeout marker —
      // we select just the marker fields so no soft-deleted application
      // payload can leak.
      const expired = await this.prisma.application.findFirst({
        where: { resumeToken, expiredReason: 'PAYMENT_WINDOW_EXPIRED' },
        select: { id: true, deletedAt: true },
      });
      if (expired && expired.deletedAt) {
        throw new BaseException({
          code: ErrorCodes.PAYMENT_WINDOW_EXPIRED,
          statusCode: HttpStatus.GONE, // 410
          message: 'Payment window expired',
          details: [
            {
              reason: ErrorCodes.PAYMENT_WINDOW_EXPIRED,
              message:
                "This application's payment window has expired. Please start a new application.",
            },
          ],
        });
      }
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'No application found with this resume token',
        },
      ]);
    }

    // Check ownership
    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
      ]);
    }

    // Stage 3 Step 5 — EXPIRED is terminal and NOT resumable.
    //
    // The timeout sweep used to soft-delete, so an expired application
    // fell out of the lookup above and the 410 came from the not-found
    // branch (keyed on `deletedAt`). Now that it expires to a STATUS and
    // stays visible, that lookup succeeds — without this check the
    // customer would be handed a perfectly resumable draft for an
    // application whose payment window has already closed.
    if (application.currentStatus === ApplicationStatus.EXPIRED) {
      throw new BaseException({
        code: ErrorCodes.PAYMENT_WINDOW_EXPIRED,
        statusCode: HttpStatus.GONE, // 410
        message: 'Payment window expired',
        details: [
          {
            reason: ErrorCodes.PAYMENT_WINDOW_EXPIRED,
            message:
              "This application's payment window has expired. Please start a new application.",
          },
        ],
      });
    }

    return this.mapToResponse(application);
  }

  // =====================
  // Admin Review Actions
  // =====================

  /**
   * Valid statuses for the SECOND decision (approve / reject).
   *
   * Stage 3 Step 4 — PROCESSING only. SUBMITTED was allowed while the
   * accept action was being built, but leaving it in meant an operator
   * could approve or reject an application whose funds were still merely
   * AUTHORIZED — approving without ever capturing (money never taken) or
   * rejecting with nothing to refund. The first decision (accept →
   * capture, cancel → release) is now the only way out of SUBMITTED, so
   * by the time we get here the payment is always PAID.
   */
  private readonly APPROVABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.PROCESSING,
  ];

  /** Valid statuses that can be rejected — see APPROVABLE_STATUSES. */
  private readonly REJECTABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.PROCESSING,
  ];

  /**
   * Approve an application (Admin)
   */
  async approveApplication(
    id: string,
    dto: ApproveApplicationDto,
    adminUserId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    // Validate status transition
    if (!this.APPROVABLE_STATUSES.includes(application.currentStatus as ApplicationStatus)) {
      throw new BadRequestException('Application cannot be approved', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Application in ${application.currentStatus} status cannot be approved. It must be in PROCESSING (accepted by an operator) first.`,
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.APPROVED;

    // Update application status
    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
        adminNote: dto.note || null,
      },
      include: this.getApplicationIncludes(),
    });

    // Create status history
    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: dto.note || 'Application approved by admin',
        changedByUserId: adminUserId,
        changedBySystem: false,
      },
    });

    // Audit log
    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.approve',
      'Application',
      id,
      { status: oldStatus },
      { status: newStatus, note: dto.note },
    );

    // Send notification email
    await this.sendStatusNotificationEmail(
      updatedApplication,
      'Approved',
      dto.note || 'Your visa application has been approved.',
    );

    this.logger.log(`Application approved: ${id} by admin ${adminUserId}`);

    void this.notificationEmitter.emit('app.approved', {
      applicationId: id,
      applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
      actorUserId: adminUserId,
      applicantCount: updatedApplication.applicants?.length ?? 0,
    });

    return this.mapToResponse(updatedApplication);
  }

  /**
   * Reject an application (Admin)
   */
  async rejectApplication(
    id: string,
    dto: RejectApplicationDto,
    adminUserId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    // Validate status transition
    if (!this.REJECTABLE_STATUSES.includes(application.currentStatus as ApplicationStatus)) {
      throw new BadRequestException('Application cannot be rejected', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Application in ${application.currentStatus} status cannot be rejected. It must be in PROCESSING (accepted by an operator) first.`,
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.REJECTED;

    // ── Stage 3 Step 4 — selective refund ──
    //
    // The money was captured at Accept, so rejecting is a refund
    // decision, not a release. The operator picks which portions go
    // back; picking neither is valid (reject, refund nothing). Same
    // atomicity shape as accept/cancel: validate → provider call
    // OUTSIDE the transaction → every DB write inside ONE transaction.
    const portions = {
      government: dto.refundGovernmentFee === true,
      service: dto.refundServiceFee === true,
    };
    const wantsRefund = portions.government || portions.service;

    let payment: Awaited<
      ReturnType<PaymentsService['getCapturedPaymentForApplication']>
    > | null = null;
    if (wantsRefund) {
      payment = await this.paymentsService.getCapturedPaymentForApplication(id);
      this.paymentsService.assertRefundablePortions(payment, portions);
      await this.paymentsService.runProviderRefund(payment, portions);
    }

    const now = new Date();
    let refundedPaymentStatus:
      | Awaited<ReturnType<PaymentsService['recordRefundWithinTx']>>
      | null = null;

    const updatedApplication = await this.prisma.$transaction(async tx => {
      if (payment) {
        refundedPaymentStatus = await this.paymentsService.recordRefundWithinTx(
          tx,
          payment,
          portions,
          adminUserId,
          dto.reason,
        );
      }

      const updated = await tx.application.update({
        where: { id },
        data: {
          currentStatus: newStatus,
          reviewedAt: now,
          reviewedByUserId: adminUserId,
          adminNote: dto.reason,
          rejectionReason: dto.reason,
          // Keep the application's payment dimension in step with the
          // payment row. With no refund it stays exactly as it was.
          ...(refundedPaymentStatus ? { paymentStatus: refundedPaymentStatus } : {}),
        },
        include: this.getApplicationIncludes(),
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          oldStatus,
          newStatus,
          note: dto.reason,
          changedByUserId: adminUserId,
          changedBySystem: false,
        },
      });

      return updated;
    });

    // Audit log
    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.reject',
      'Application',
      id,
      { status: oldStatus },
      {
        status: newStatus,
        reason: dto.reason,
        refundedPortions: wantsRefund ? portions : null,
        paymentStatus: refundedPaymentStatus ?? undefined,
        paymentId: payment?.id,
      },
    );

    // Send notification email
    await this.sendStatusNotificationEmail(
      updatedApplication,
      'Rejected',
      dto.reason,
    );

    this.logger.log(`Application rejected: ${id} by admin ${adminUserId}`);

    void this.notificationEmitter.emit('app.rejected', {
      applicationId: id,
      applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
      reason: dto.reason,
      actorUserId: adminUserId,
    });

    return this.mapToResponse(updatedApplication);
  }

  /**
   * M11.12 (BUG P) — Unified status change.
   *
   * Subsumes approve / reject into a single endpoint that:
   *   1. Validates the requested transition (per-status source-state
   *      checks reuse the existing APPROVABLE / REJECTABLE constants).
   *   2. Validates per-status required fields (reason for REJECTED,
   *      custom subject + body for emailMode='custom').
   *   3. Updates the application + writes status history + audit log.
   *   4. If sendEmail is true (default), sends either:
   *        - the standard template + optional "Message from our team"
   *          custom block (template mode, the default), or
   *        - the operator's custom subject + body verbatim
   *          (custom mode — bypasses the template entirely).
   *
   * Stage 3 (Step 1): the document-request + under-review targets are
   * gone: documents are now requested by email outside the system and
   * the operator decides straight from SUBMITTED. The accept (→PROCESSING,
   * capture) and disqualify (→CANCELLED, release) actions land in
   * Step 3; the legacy approve / reject endpoints stay for back-compat.
   */
  async changeStatus(
    id: string,
    dto: ChangeApplicationStatusDto,
    adminUserId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);
    const oldStatus = application.currentStatus as ApplicationStatus;
    const target = dto.status as unknown as ApplicationStatus;

    // ── per-target transition + payload validation ──
    const TRANSITIONS: Record<string, ApplicationStatus[]> = {
      APPROVED: this.APPROVABLE_STATUSES,
      // Stage 3 Step 6 — REJECTED is deliberately NOT reachable through
      // this generic endpoint. Rejecting is a refund decision (which fee
      // portions go back to the customer) and only `rejectApplication`
      // asks for and performs it; routing a rejection through here would
      // silently keep the customer's entire captured payment.
      // Same reasoning as CANCELLED below.

      // M11.14 (BUG FF) — operator must release the issued visa
      // by transitioning APPROVED → READY_TO_DOWNLOAD. The
      // hasPrimaryFile() gate below enforces that a primary
      // visa file exists before the customer sees a download
      // link in their email.
      READY_TO_DOWNLOAD: [ApplicationStatus.APPROVED],
      // Stage 3 — only the pre-payment states may be cancelled through
      // this generic endpoint. Once funds are held (SUBMITTED) or
      // captured (PROCESSING), cancelling MUST go through
      // `cancelApplication`, which releases the authorization —
      // otherwise the application would read CANCELLED while the
      // customer's money is still held or already taken.
      CANCELLED: [ApplicationStatus.DRAFT, ApplicationStatus.UNPAID],
    };
    const allowedFrom = TRANSITIONS[dto.status];
    if (!allowedFrom || !allowedFrom.includes(oldStatus)) {
      throw new BadRequestException(`Cannot move application to ${dto.status}`, [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Application in ${oldStatus} status cannot transition to ${dto.status}. Allowed source statuses: ${(allowedFrom ?? []).join(', ') || '(none)'}.`,
        },
      ]);
    }
    if (dto.status === 'REJECTED' && (!dto.reason || dto.reason.trim().length < 10)) {
      throw new BadRequestException('Rejection reason required', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'A rejection reason of at least 10 characters is required when status=REJECTED.',
        },
      ]);
    }
    if (dto.status === 'READY_TO_DOWNLOAD') {
      // M11.14 (BUG FF) — must have at least one primary result
      // file before the operator can release the visa. The
      // admin status dialog uploads files BEFORE calling this
      // endpoint, so by the time we hit this gate the row
      // should already exist.
      const primaryCount = await this.prisma.applicationResultFile.count({
        where: { applicationId: id, isPrimary: true, deletedAt: null },
      });
      if (primaryCount === 0) {
        throw new BadRequestException(
          'A primary visa file must be uploaded before releasing the visa',
          [
            {
              reason: ErrorCodes.BAD_REQUEST,
              message:
                'Upload at least one visa file (PDF/JPG/PNG/WEBP) and mark it as primary before changing status to READY_TO_DOWNLOAD.',
            },
          ],
        );
      }
    }
    if (dto.emailMode === 'custom' && (!dto.customSubject || !dto.customBody)) {
      throw new BadRequestException('Custom email requires subject + body', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'When emailMode=custom, both customSubject and customBody are required.',
        },
      ]);
    }

    // ── apply the status change + side-effects ──
    const newStatusEnum = target;
    const updateData: any = {
      currentStatus: newStatusEnum,
    };
    if (dto.status === 'APPROVED' || dto.status === 'REJECTED') {
      updateData.reviewedAt = new Date();
      updateData.reviewedByUserId = adminUserId;
    }
    if (dto.status === 'REJECTED') {
      updateData.rejectionReason = dto.reason;
    }
    if (dto.customMessage) {
      updateData.adminNote = dto.customMessage;
    }

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: updateData,
      include: this.getApplicationIncludes(),
    });

    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus: newStatusEnum,
        note: dto.customMessage ?? dto.reason ?? `Status changed to ${dto.status}`,
        changedByUserId: adminUserId,
        changedBySystem: false,
      },
    });

    await this.auditLogsService.logAdminAction(
      adminUserId,
      `application.status_change.${dto.status.toLowerCase()}`,
      'Application',
      id,
      { status: oldStatus },
      {
        status: dto.status,
        sendEmail: dto.sendEmail !== false,
        emailMode: dto.emailMode ?? 'template',
        hasCustomMessage: !!dto.customMessage,
        reason: dto.reason,
      },
    );

    // ── send email (best-effort; never block the response) ──
    const sendEmail = dto.sendEmail !== false;
    if (sendEmail) {
      try {
        await this.sendChangeStatusEmail(updatedApplication, dto);
      } catch (err) {
        this.logger.error(
          `[BUG P] sendChangeStatusEmail failed for application ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      this.logger.log(`[BUG P] sendEmail=false for ${id}; skipping notification`);
    }

    // Best-effort downstream notifications (Telegram, etc.).
    if (dto.status === 'APPROVED') {
      void this.notificationEmitter.emit('app.approved', {
        applicationId: id,
        applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
        actorUserId: adminUserId,
        applicantCount: updatedApplication.applicants?.length ?? 0,
      });
    } else if (dto.status === 'REJECTED') {
      void this.notificationEmitter.emit('app.rejected', {
        applicationId: id,
        applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
        reason: dto.reason ?? '',
        actorUserId: adminUserId,
      });
    }

    this.logger.log(
      `[BUG P] Status changed: ${id}  ${oldStatus} → ${dto.status}  by admin ${adminUserId}  (email=${sendEmail}, mode=${dto.emailMode ?? 'template'})`,
    );
    return this.mapToResponse(updatedApplication);
  }

  // ════════════════════════════════════════════════════════════════════
  // Stage 3 — FIRST DECISION (accept / cancel)
  //
  // Both actions run on a SUBMITTED application whose payment is
  // AUTHORIZED (funds held). They are the moment money actually moves, so
  // each one performs the provider call FIRST (an external side effect
  // that cannot be rolled back) and then writes the payment change, the
  // application change, the status history and the assignment inside ONE
  // transaction — a half-applied accept would otherwise leave captured
  // funds on a SUBMITTED application, or a released authorization on an
  // application that still looks payable.
  // ════════════════════════════════════════════════════════════════════

  /**
   * ACCEPT — capture the held funds, assign an operator (picked at accept
   * time), move the application to PROCESSING and tell the customer their
   * visa is being prepared.
   */
  async acceptApplication(
    id: string,
    dto: AcceptApplicationDto,
    adminUserId: string,
    actorPermissions?: string[],
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    if (application.currentStatus !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application cannot be accepted', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Only a SUBMITTED application can be accepted (current: ${application.currentStatus}).`,
        },
      ]);
    }

    // Funds must actually be held before we promise the customer anything.
    const payment = await this.paymentsService.getAuthorizedPaymentForApplication(id);

    const assignee = await this.prisma.user.findFirst({
      where: { id: dto.assigneeId, deletedAt: null, isActive: true },
      select: { id: true, fullName: true, email: true },
    });
    if (!assignee) {
      throw new BadRequestException('Assignee not found or inactive', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'The selected operator is no longer available.',
        },
      ]);
    }

    // Same RBAC split as assignOperator: assigning the work to someone
    // else needs applications.assign; claiming it yourself does not.
    if (actorPermissions !== undefined) {
      const canAssignOthers = actorPermissions.includes('applications.assign');
      if (!canAssignOthers && dto.assigneeId !== adminUserId) {
        throw new ForbiddenException('You may only assign this application to yourself.', [
          {
            reason: ErrorCodes.FORBIDDEN,
            message:
              'Assigning to another operator requires the applications.assign permission.',
          },
        ]);
      }
    }

    // External side effect first — if the provider declines, nothing in
    // the database has changed yet.
    const providerReference = await this.paymentsService.runProviderCapture(payment);

    const oldStatus = application.currentStatus as ApplicationStatus;
    const previousAssigneeId = (application as any).assignedToUserId ?? null;
    const now = new Date();

    const updatedApplication = await this.prisma.$transaction(async tx => {
      await this.paymentsService.recordCaptureWithinTx(
        tx,
        payment,
        adminUserId,
        providerReference,
      );

      const updated = await tx.application.update({
        where: { id },
        data: {
          currentStatus: ApplicationStatus.PROCESSING,
          // Keep the application's payment dimension in step with the
          // payment row now that the funds are captured.
          paymentStatus: PaymentStatus.PAID,
          reviewedAt: now,
          reviewedByUserId: adminUserId,
          assignedToUserId: dto.assigneeId,
          assignedAt: now,
          assignedByUserId: adminUserId,
          ...(dto.note ? { adminNote: dto.note } : {}),
        },
        include: this.getApplicationIncludes(),
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          oldStatus,
          newStatus: ApplicationStatus.PROCESSING,
          note:
            dto.note ??
            'Application accepted — payment captured, processing started',
          changedByUserId: adminUserId,
          changedBySystem: false,
        },
      });

      if (previousAssigneeId !== dto.assigneeId) {
        await tx.applicationAssignmentHistory.create({
          data: {
            applicationId: id,
            previousAssigneeId,
            newAssigneeId: dto.assigneeId,
            changedBy: adminUserId,
            reason: 'Assigned at accept',
          },
        });
      }

      return updated;
    });

    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.accept',
      'Application',
      id,
      { status: oldStatus, paymentStatus: PaymentStatus.AUTHORIZED, assignedToUserId: previousAssigneeId },
      {
        status: ApplicationStatus.PROCESSING,
        paymentStatus: PaymentStatus.PAID,
        assignedToUserId: dto.assigneeId,
        paymentId: payment.id,
      },
    );

    await this.sendStatusNotificationEmail(
      updatedApplication,
      'Processing',
      dto.note || undefined,
    );

    this.logger.log(
      `Application accepted: ${id} by ${adminUserId} (payment ${payment.id} captured, assigned to ${dto.assigneeId})`,
    );

    void this.notificationEmitter.emit('app.event', {
      kind: 'application.accepted',
      applicationId: id,
      applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
      actorUserId: adminUserId,
      assigneeId: dto.assigneeId,
      paymentId: payment.id,
    });

    return this.mapToResponse(updatedApplication);
  }

  /**
   * CANCEL — a disqualifying issue was found. Release the authorization
   * in full (nothing is charged), move the application to CANCELLED
   * (terminal) and email the customer the reason plus an invitation to
   * submit a new application.
   */
  async cancelApplication(
    id: string,
    dto: CancelApplicationDto,
    adminUserId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    if (application.currentStatus !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application cannot be cancelled', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Only a SUBMITTED application can be cancelled at the first decision (current: ${application.currentStatus}).`,
        },
      ]);
    }

    const payment = await this.paymentsService.getAuthorizedPaymentForApplication(id);

    // External side effect first.
    const providerReference = await this.paymentsService.runProviderRelease(payment);

    const oldStatus = application.currentStatus as ApplicationStatus;
    const now = new Date();

    const updatedApplication = await this.prisma.$transaction(async tx => {
      await this.paymentsService.recordReleaseWithinTx(
        tx,
        payment,
        adminUserId,
        dto.reason,
        providerReference,
      );

      const updated = await tx.application.update({
        where: { id },
        data: {
          currentStatus: ApplicationStatus.CANCELLED,
          // Nothing was charged — mirror the released authorization.
          paymentStatus: PaymentStatus.CANCELLED,
          reviewedAt: now,
          reviewedByUserId: adminUserId,
          adminNote: dto.reason,
        },
        include: this.getApplicationIncludes(),
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          oldStatus,
          newStatus: ApplicationStatus.CANCELLED,
          note: dto.reason,
          changedByUserId: adminUserId,
          changedBySystem: false,
        },
      });

      return updated;
    });

    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.cancel',
      'Application',
      id,
      { status: oldStatus, paymentStatus: PaymentStatus.AUTHORIZED },
      {
        status: ApplicationStatus.CANCELLED,
        paymentStatus: PaymentStatus.CANCELLED,
        reason: dto.reason,
        paymentId: payment.id,
      },
    );

    await this.sendStatusNotificationEmail(updatedApplication, 'Cancelled', dto.reason);

    this.logger.log(
      `Application cancelled: ${id} by ${adminUserId} (payment ${payment.id} released, no charge)`,
    );

    void this.notificationEmitter.emit('app.event', {
      kind: 'application.cancelled',
      applicationId: id,
      applicationCode: updatedApplication.applicants?.[0]?.applicationCode,
      actorUserId: adminUserId,
      reason: dto.reason,
      paymentId: payment.id,
    });

    return this.mapToResponse(updatedApplication);
  }

  /**
   * M-Assign — Assign / reassign / unassign an operator.
   *
   * - assigneeId = null|undefined → unassign (clear all three
   *   `assigned*` columns)
   * - assigneeId = <user id> → assign or reassign
   *
   * Writes ApplicationAssignmentHistory in the same transaction +
   * fires audit + a best-effort Telegram emit so the activity
   * channel reflects every change. Validates the assignee is an
   * active admin user before assigning.
   */
  async assignOperator(
    applicationId: string,
    assigneeId: string | null,
    actorUserId: string,
    reason?: string,
    actorPermissions?: string[],
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(applicationId);

    // M11.14 (RBAC audit) — Cross-user assignment requires the dedicated
    // `applications.assign` permission. Operators (who hold
    // `applications.update`) can still self-assign or self-unassign,
    // which is the daily "claim my own work" flow. Any attempt to
    // assign to another user — or unassign someone else's claim —
    // fails closed with 403 unless the actor has applications.assign.
    if (actorPermissions !== undefined) {
      const canAssignOthers = actorPermissions.includes('applications.assign');
      const previousAssigneeId =
        (application as any).assignedToUserId ?? null;
      const isSelfAssign = assigneeId === actorUserId;
      const isSelfUnassign =
        assigneeId === null && previousAssigneeId === actorUserId;
      if (!canAssignOthers && !isSelfAssign && !isSelfUnassign) {
        throw new ForbiddenException(
          'You may only self-assign or unassign yourself.',
          [
            {
              reason: ErrorCodes.FORBIDDEN,
              message:
                'Cross-user assignment requires the applications.assign permission. Operators can only assign or unassign themselves.',
            },
          ],
        );
      }
    }

    if (assigneeId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: assigneeId, deletedAt: null, isActive: true },
        select: { id: true, fullName: true, email: true },
      });
      if (!assignee) {
        throw new BadRequestException('Assignee not found or inactive', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: 'The selected operator is no longer available.',
          },
        ]);
      }
    }

    const previousAssigneeId = (application as any).assignedToUserId ?? null;
    if (previousAssigneeId === assigneeId) {
      // No-op assignment — return current state, don't write history.
      return this.mapToResponse(application);
    }

    const now = new Date();
    const [updated] = await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: {
          assignedToUserId: assigneeId,
          assignedAt: assigneeId ? now : null,
          assignedByUserId: assigneeId ? actorUserId : null,
        },
        include: this.getApplicationIncludes(),
      }),
      this.prisma.applicationAssignmentHistory.create({
        data: {
          applicationId,
          previousAssigneeId,
          newAssigneeId: assigneeId,
          changedBy: actorUserId,
          reason: reason ?? null,
        },
      }),
    ]);

    await this.auditLogsService.logAdminAction(
      actorUserId,
      'application.assign',
      'Application',
      applicationId,
      { previousAssigneeId },
      { newAssigneeId: assigneeId, reason: reason ?? null },
    );

    // Telegram (best-effort, post-commit)
    void this.notificationEmitter.emit('app.assigned', {
      applicationId,
      applicationCode: updated.applicants?.[0]?.applicationCode,
      previousAssigneeId,
      newAssigneeId: assigneeId,
      actorUserId,
    });

    this.logger.log(
      `[M-Assign] Application ${applicationId} ${assigneeId ? `assigned to ${assigneeId}` : 'unassigned'} by ${actorUserId}`,
    );
    return this.mapToResponse(updated);
  }

  /**
   * M-Assign — Add an internal-only note to an application. The
   * note is operator-side only — never sent to customer. Author is
   * recorded so the UI can render edit/delete affordances only on
   * the author's own notes.
   */
  async addInternalNote(
    applicationId: string,
    actorUserId: string,
    note: string,
  ): Promise<any> {
    const exists = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist',
        },
      ]);
    }
    const created = await this.prisma.applicationInternalNote.create({
      data: {
        applicationId,
        userId: actorUserId,
        note: note.trim(),
        visibility: 'internal',
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    await this.auditLogsService.logAdminAction(
      actorUserId,
      'application.note_added',
      'ApplicationInternalNote',
      created.id,
      undefined,
      { applicationId, note: note.slice(0, 120) },
    );
    return created;
  }

  async listInternalNotes(applicationId: string): Promise<any[]> {
    return this.prisma.applicationInternalNote.findMany({
      where: { applicationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  /**
   * M-Assign — Update an internal note. Only the original author
   * can edit. Super admins should use this endpoint too (their
   * role has applications.note_manage which the controller
   * permission guard accepts; the service still enforces author-
   * only edit so an admin can't silently rewrite an operator's
   * note as if it were their own).
   */
  async updateInternalNote(
    noteId: string,
    actorUserId: string,
    note: string,
  ): Promise<any> {
    const existing = await this.prisma.applicationInternalNote.findFirst({
      where: { id: noteId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Note not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Note does not exist' },
      ]);
    }
    if (existing.userId !== actorUserId) {
      throw new ForbiddenException('Only the author can edit this note', [
        { reason: ErrorCodes.FORBIDDEN, message: 'You did not write this note.' },
      ]);
    }
    const updated = await this.prisma.applicationInternalNote.update({
      where: { id: noteId },
      data: { note: note.trim(), updatedAt: new Date() },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    await this.auditLogsService.logAdminAction(
      actorUserId,
      'application.note_updated',
      'ApplicationInternalNote',
      noteId,
      { note: existing.note.slice(0, 120) },
      { note: note.slice(0, 120) },
    );
    return updated;
  }

  /**
   * Soft-delete an internal note. Author OR super admin may delete.
   * The controller permission guard determines who can call this
   * — we keep an author check as defense-in-depth.
   */
  async deleteInternalNote(noteId: string, actorUserId: string): Promise<void> {
    const existing = await this.prisma.applicationInternalNote.findFirst({
      where: { id: noteId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Note not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Note does not exist' },
      ]);
    }
    // Author OR caller has note_manage permission (controller
    // already gates on the permission; the author check here is
    // belt-and-suspenders).
    await this.prisma.applicationInternalNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date() },
    });
    await this.auditLogsService.logAdminAction(
      actorUserId,
      'application.note_deleted',
      'ApplicationInternalNote',
      noteId,
      { note: existing.note.slice(0, 120), authorId: existing.userId },
      undefined,
    );
  }

  /**
   * M-Assign — Operator dropdown source. Active admin users who
   * can be assigned. For now, every active user is assignable;
   * future versions might filter by an `applications.assignable`
   * permission.
   */
  async listAssignableUsers(): Promise<
    Array<{ id: string; fullName: string; email: string; roleKey?: string }>
  > {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: { select: { key: true } },
      },
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      roleKey: u.role?.key,
    }));
  }

  /**
   * M11.12 (BUG P) — Send the email side of `changeStatus`.
   *
   * `template` mode: pick the right canonical template
   * (application.approved / .rejected / .need_docs) and pass the
   * customMessage as a "Message from our team" block via the
   * `notes` variable (existing templates already render
   * `{{notes}}` in a colored callout).
   *
   * `custom` mode: skip the template, send the operator's
   * customSubject + customBody verbatim via emailService.sendEmail
   * (no variable interpolation), then audit one
   * notification.email_sent row per recipient.
   */
  private async sendChangeStatusEmail(
    application: any,
    dto: ChangeApplicationStatusDto,
  ): Promise<void> {
    // Recipients: portal email + each applicant.email, deduped.
    const recipients = new Set<string>();
    if (application.portalIdentity?.email) {
      recipients.add(application.portalIdentity.email.toLowerCase().trim());
    }
    for (const applicant of application.applicants ?? []) {
      if (applicant.email) recipients.add(applicant.email.toLowerCase().trim());
    }
    if (recipients.size === 0) {
      this.logger.warn(`[BUG P] No recipients for application ${application.id}`);
      return;
    }

    if (dto.emailMode === 'custom') {
      // Operator-supplied subject/body, sent verbatim. We use the
      // 'raw_email' system template which has just {{subject}} and
      // {{body}} placeholders — no other variables get interpolated.
      const subject = dto.customSubject ?? '';
      const body = dto.customBody ?? '';
      for (const recipient of recipients) {
        try {
          const result = await this.emailService.sendTemplatedEmail({
            to: recipient,
            templateKey: 'raw_email',
            variables: { subject, body, htmlBody: body },
            relatedEntity: 'Application',
            relatedEntityId: application.id,
          });
          await this.auditLogsService.logSystemAction(
            'notification.email_sent',
            'Application',
            application.id,
            undefined,
            {
              recipient,
              templateKey: 'raw_email',
              subject,
              success: result.success,
              messageId: result.messageId ?? null,
              error: result.error ?? null,
              custom: true,
            },
          );
        } catch (err) {
          this.logger.error(
            `[BUG P] custom email to ${recipient} failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      return;
    }

    // Template mode — reuse sendStatusNotificationEmail's mapping
    // logic but drop in the custom message.
    const STATUS_LABEL: Record<string, string> = {
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      // Stage 3 — Processing + Expired have no dedicated template yet
      // (Step 3 / Step 5 add them); they fall through to the generic
      // application_status_update template via sendStatusNotificationEmail.
      PROCESSING: 'Processing',
      EXPIRED: 'Expired',
      // M11.14 (BUG FF) — drives template selection +
      // INTENT_BY_LABEL ('download') in sendStatusNotificationEmail.
      READY_TO_DOWNLOAD: 'Ready to Download',
      CANCELLED: 'Cancelled',
    };
    const label = STATUS_LABEL[dto.status] ?? dto.status;

    let composedNote = dto.customMessage ?? '';
    if (dto.status === 'REJECTED' && dto.reason) {
      composedNote = composedNote
        ? `${composedNote}\n\nReason: ${dto.reason}`
        : `Reason: ${dto.reason}`;
    }

    await this.sendStatusNotificationEmail(application, label, composedNote || undefined);
  }

  /**
   * Re-price an application against its current head count.
   *
   * Pricing is per applicant, so adding or removing someone changes
   * what the booking costs. Called from the applicant add/remove paths;
   * without it the stored total silently keeps the old head count and
   * the customer sees one number while the payment charges another.
   *
   * Only touches applications that have not been paid for — once a
   * payment exists the amount is fixed (see the guard in
   * `assertApplicantCountChangeAllowed`), and re-pricing a captured
   * booking would make the payment and the application disagree.
   */
  async recalculateTotalFee(applicationId: string): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      include: {
        templateBinding: { include: { nationalityFees: true } },
        applicants: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!application) return;

    const editable: string[] = [ApplicationStatus.DRAFT, ApplicationStatus.UNPAID];
    if (!editable.includes(application.currentStatus as string)) return;

    const fee = application.templateBinding?.nationalityFees?.find(
      (f) =>
        f.nationalityCountryId === application.nationalityCountryId &&
        (!application.visaTypeEntryId || f.entryId === application.visaTypeEntryId) &&
        f.isActive &&
        !f.deletedAt,
    );
    if (!fee) return;

    const totals = computeFeeTotals(
      fee,
      application.applicants.length,
      application.expedited,
    );
    if (Number(application.totalFeeAmount) === totals.totalAmount) return;

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { totalFeeAmount: totals.totalAmount },
    });
    this.logger.log(
      `Re-priced ${applicationId}: ${application.applicants.length} applicant(s) -> ${totals.totalAmount}`,
    );
  }

  /**
   * An application must never be payable for an amount that does not
   * match its head count. Once a payment row exists the amount is
   * locked, so changing the number of applicants is refused rather than
   * silently re-pricing behind the payment (or worse, leaving the two
   * out of step). The customer releases the hold — Cancel, or letting
   * the window expire — and starts again with the right party size.
   */
  async assertApplicantCountChangeAllowed(applicationId: string): Promise<void> {
    const blocking = await this.prisma.payment.findFirst({
      where: {
        applicationId,
        deletedAt: null,
        paymentStatus: {
          in: [
            PaymentStatus.CREATED,
            PaymentStatus.PENDING,
            PaymentStatus.PROCESSING,
            PaymentStatus.AUTHORIZED,
            PaymentStatus.PAID,
            PaymentStatus.PARTIALLY_REFUNDED,
          ],
        },
      },
      select: { paymentStatus: true },
    });
    if (!blocking) return;

    throw new BadRequestException('Applicants cannot be changed after payment has started', [
      {
        reason: ErrorCodes.APPLICATION_NOT_EDITABLE,
        message:
          'A payment already exists for this application, so the number of applicants is fixed. Cancel the payment (or let the payment window expire) and start a new application to travel with a different number of people.',
      },
    ]);
  }

  /**
   * Get application with all necessary relations for admin operations
   */
  private async getApplicationWithRelations(id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        visaTypeEntry: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
          include: {
            // M11.8 (ISSUE 7) — admin + portal detail pages render
            // an Applicants → Documents section. Without this include
            // the response had `documents: []` even when uploads
            // existed in the documents table, so admins saw nothing.
            documents: {
              where: { deletedAt: null },
              orderBy: { uploadedAt: 'desc' },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found', [
        {
          reason: ErrorCodes.APPLICATION_NOT_FOUND,
          message: 'Application does not exist or has been deleted',
        },
      ]);
    }

    return application;
  }

  /**
   * Helper for application includes
   */
  private getApplicationIncludes() {
    return {
      portalIdentity: true,
      nationalityCountry: true,
      destinationCountry: true,
      visaType: true,
      // Entries feature (Stage 4) — the chosen entry, so admin detail +
      // list and the portal can render its label / durations.
      visaTypeEntry: true,
      template: true,
      applicants: {
        where: { deletedAt: null },
        orderBy: [{ isMainApplicant: 'desc' as const }, { createdAt: 'asc' as const }],
      },
      // Payment Stage 2 — admin detail shows the gov/service split +
      // payment state + refunded portions. Latest row first.
      payments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' as const },
      },
      // M-Assign — include the assignee for the admin detail page
      // sidebar (AssignmentAndNotesPanel). Only public-safe fields.
      assignedToUser: {
        select: { id: true, fullName: true, email: true },
      },
      assignedByUser: {
        select: { id: true, fullName: true, email: true },
      },
      // Flip-binding-flow — eager-load the binding and the matching
      // nationality fee row so status emails can quote the
      // applicant's per-nationality processing window without a
      // second round-trip. `processingTimeMin`/`Max` are gone; the
      // single `processingDays` (or `expeditedProcessingDays` when
      // the customer chose Express) is the new source.
      templateBinding: {
        select: {
          id: true,
          nationalityFees: {
            where: { deletedAt: null, isActive: true },
            select: {
              nationalityCountryId: true,
              processingDays: true,
              expeditedProcessingDays: true,
            },
          },
        },
      },
    };
  }

  /**
   * Send status notification email to the customer.
   *
   * M11.8 (ISSUE 8) — fixes three bugs at once:
   *   1. Old code referenced `application.code` which doesn't exist
   *      on the Application model and silently fell back to the
   *      first 8 chars of the row UUID — that gibberish was what
   *      reached customers and broke /track lookups.
   *   2. Only the portal-identity email was notified; co-applicants
   *      with their own contact email got nothing.
   *   3. No audit row was written, so we couldn't tell from the
   *      audit log whether a notification actually fired.
   *
   * Now: resolve the canonical `APP-YYYY-NNNNNN` code from
   * `applicants[0].applicationCode`, pick a status-specific
   * template via STATUS_TEMPLATE_KEY (falls back to the unified
   * `application_status_update` template if nothing matches), send
   * to the deduped union of {portal email, every applicant email},
   * and emit one `notification.email_sent` audit row per recipient.
   */
  /**
   * Stage 3 Step 4 — public entry point for surfaces that only hold an
   * applicationId (e.g. the automatic READY_TO_DOWNLOAD transition in
   * ApplicantsService). Loads the application with the relations the
   * templating needs, then reuses the one correct sender — which mints a
   * per-recipient signed `ctaUrl` and fans out to the portal identity
   * plus every applicant. Before this existed, the automatic path
   * hand-rolled its own send with the wrong variables and produced a
   * dead `href=""` download button for a single recipient.
   */
  async notifyStatusChange(
    applicationId: string,
    statusLabel: string,
    notes?: string,
  ): Promise<void> {
    const application = await this.getApplicationWithRelations(applicationId);
    await this.sendStatusNotificationEmail(application, statusLabel, notes);
  }

  private async sendStatusNotificationEmail(
    application: any,
    statusLabel: string,
    notes?: string,
  ): Promise<void> {
    const applicationCode =
      application.applicants?.find((a: any) => a.isMainApplicant)?.applicationCode ??
      application.applicants?.[0]?.applicationCode ??
      null;

    if (!applicationCode) {
      this.logger.warn(
        `No applicationCode found for application ${application.id}; skipping status notification email`,
      );
      return;
    }

    // Status label → template key. Anything unrecognized falls back
    // to the unified template so future statuses degrade gracefully.
    const STATUS_TEMPLATE_KEY: Record<string, string> = {
      Approved: 'application.approved',
      Rejected: 'application.rejected',
      'Additional Documents Required': 'application.need_docs',
      'Ready to Download': 'application.ready_to_download',
      'Documents Resubmitted': 'application.documents.resubmitted',
      // Stage 3 — first-decision outcomes. These labels come from
      // STATUS_LABEL (PROCESSING → 'Processing', CANCELLED → 'Cancelled'),
      // so an accept/cancel resolves to its own template instead of
      // silently falling back to application_status_update.
      Processing: 'application.processing_started',
      Cancelled: 'application.cancelled',
    };
    const templateKey =
      STATUS_TEMPLATE_KEY[statusLabel] ?? 'application_status_update';

    // Build recipient list: portal email + each applicant.email,
    // case-insensitive dedup so we never double-send.
    const recipients = new Set<string>();
    if (application.portalIdentity?.email) {
      recipients.add(application.portalIdentity.email.toLowerCase().trim());
    }
    for (const applicant of application.applicants ?? []) {
      if (applicant.email) {
        recipients.add(applicant.email.toLowerCase().trim());
      }
    }
    if (recipients.size === 0) {
      this.logger.warn(`No recipients found for application ${application.id}`);
      return;
    }

    // M11.14 (BUG FF) — pull names + flag once so each per-recipient
    // var bag below stays tidy. firstName / lastName surface
    // separately for any template that wants finer-grained
    // personalization than {{fullName}}.
    const mainApplicant = application.applicants?.find(
      (a: any) => a.isMainApplicant,
    );
    const mainFormData = (mainApplicant?.formDataJson ?? {}) as Record<string, unknown>;
    const firstName = String(mainFormData.firstName ?? '').trim();
    const lastName = String(mainFormData.lastName ?? '').trim();
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') || 'Applicant';
    const destinationFlag = (application.destinationCountry as any)?.flagEmoji ?? '';
    const supportEmail =
      this.configService.get<string>('SUPPORT_EMAIL') ?? 'support@evisaglobal.com';

    const baseUrl = (
      this.configService.get<string>('FRONTEND_URL') ??
      this.configService.get<string>('PUBLIC_BASE_URL') ??
      'https://evisaglobal.com'
    ).replace(/\/+$/, '');

    // M11.13 (BUG U + T) — Intent picks the right tab on the
    // /portal/[code] page. The fallback to /me when the recipient
    // doesn't match the audience check is gone because the token
    // verifier itself enforces the audience match — there's no
    // value in a stale generic /me link any more.
    const INTENT_BY_LABEL: Record<string, 'upload' | 'download' | 'status'> = {
      'Additional Documents Required': 'upload',
      'Ready to Download': 'download',
    };
    const intent = INTENT_BY_LABEL[statusLabel] ?? 'status';
    const deepLinkCode = application.referenceCode ?? applicationCode;

    for (const recipient of recipients) {
      // Per-recipient signed token, embedded in the per-recipient
      // ctaUrl. Stateless — 24h TTL, expires on its own.
      const token = this.portalToken.mint({
        applicationId: application.id,
        email: recipient,
        intent,
      });
      const ctaUrl = `${baseUrl}/portal/${encodeURIComponent(deepLinkCode)}?token=${token}`;

      // M11.14 (BUG FF — PART 1) — broaden the var bag so every
      // placeholder the system templates reference resolves. The
      // renderer (substituteVariables) now strips any leftover
      // `{{anyVar}}` to '' AND logs the unresolved keys — but the
      // first defense is to actually pass the values.
      // Flip-binding-flow — processing window is now per-nationality
      // on `binding_nationality_fees`. Pick the fee row that matches
      // THIS application's nationality (via the eager load above),
      // then surface the standard processing window as a single
      // number. Both legacy template variables ({{processingTimeMin}}
      // and {{processingTimeMax}}) are kept pointing at the SAME
      // value so old email templates that reference the M11.14 range
      // still render — they just show "X-X days" instead of an
      // arbitrary range. New templates should use {{processingDays}}.
      const matchingFee = (
        (application as any).templateBinding?.nationalityFees ?? []
      ).find(
        (f: { nationalityCountryId: string }) =>
          f.nationalityCountryId === application.nationalityCountryId,
      );
      const procDays = matchingFee?.processingDays ?? 3;
      const expressDays = matchingFee?.expeditedProcessingDays ?? null;

      const variables = {
        fullName,
        firstName,
        lastName,
        email: recipient,
        applicationCode,
        applicationRef: applicationCode,
        referenceCode: application.referenceCode ?? '',
        applicationStatus: statusLabel,
        status: statusLabel,
        statusLabel,
        destinationCountry: application.destinationCountry?.name ?? '',
        destinationFlag,
        visaType: application.visaType?.label ?? '',
        totalAmount: application.totalFeeAmount?.toString?.() ?? '',
        paymentAmount: application.totalFeeAmount?.toString?.() ?? '',
        currencyCode: application.currencyCode ?? '',
        ctaUrl,
        supportEmail,
        notes: notes ?? '',
        // Flip-binding-flow — processing window is now a single
        // per-nationality number. Legacy {{processingTimeMin/Max/Range}}
        // template variables are kept (pointing at the same value) so
        // old email templates still render. New templates should use
        // {{processingDays}} and {{expeditedProcessingDays}}.
        processingDays: String(procDays),
        expeditedProcessingDays: expressDays != null ? String(expressDays) : '',
        processingTimeMin: String(procDays),
        processingTimeMax: String(procDays),
        processingTimeRange: `${procDays}`,
      };
      try {
        const result = await this.emailService.sendTemplatedEmail({
          to: recipient,
          templateKey,
          variables,
          relatedEntity: 'Application',
          relatedEntityId: application.id,
        });
        this.logger.log(
          `[ISSUE 8] notify ${recipient} for ${applicationCode} via ${templateKey} → ${result.success ? 'ok' : 'fail'}`,
        );
        // Audit each successful (and failed) send so the admin trail
        // shows exactly what fired and to whom.
        await this.auditLogsService.logSystemAction(
          'notification.email_sent',
          'Application',
          application.id,
          undefined,
          {
            recipient,
            templateKey,
            applicationCode,
            statusLabel,
            success: result.success,
            messageId: result.messageId ?? null,
            error: result.error ?? null,
          },
        );
      } catch (error) {
        this.logger.error(
          `Failed to send ${templateKey} to ${recipient} for application ${application.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  private mapToResponse(application: any): ApplicationResponseDto {
    return {
      id: application.id,
      // M11.10 (BUG 4) — Surface the booking-level reference code so
      // the success page, /me, and any admin detail view can render
      // both REF + APP codes side-by-side.
      referenceCode: application.referenceCode ?? null,
      portalIdentityId: application.portalIdentityId,
      nationalityCountryId: application.nationalityCountryId,
      destinationCountryId: application.destinationCountryId,
      visaTypeId: application.visaTypeId,
      visaTypeEntryId: application.visaTypeEntryId ?? null,
      templateId: application.templateId,
      templateBindingId: application.templateBindingId,
      totalFeeAmount: application.totalFeeAmount.toString(),
      currencyCode: application.currencyCode,
      expedited: application.expedited,
      paymentStatus: application.paymentStatus,
      paymentDeadlineAt: application.paymentDeadlineAt || undefined,
      resumeToken: application.resumeToken,
      currentStatus: application.currentStatus,
      reviewedAt: application.reviewedAt || undefined,
      reviewedByUserId: application.reviewedByUserId || undefined,
      adminNote: application.adminNote || undefined,
      rejectionReason: application.rejectionReason || undefined,
      requestedDocumentTypes: application.requestedDocumentTypes || undefined,
      estimatedProcessingDays: application.estimatedProcessingDays ?? null,
      estimatedTimeUpdatedAt: application.estimatedTimeUpdatedAt ?? null,
      portalIdentity: application.portalIdentity
        ? {
            id: application.portalIdentity.id,
            email: application.portalIdentity.email,
          }
        : undefined,
      nationalityCountry: application.nationalityCountry
        ? {
            id: application.nationalityCountry.id,
            name: application.nationalityCountry.name,
            slug: application.nationalityCountry.slug,
            isoCode: application.nationalityCountry.isoCode,
          }
        : undefined,
      destinationCountry: application.destinationCountry
        ? {
            id: application.destinationCountry.id,
            name: application.destinationCountry.name,
            slug: application.destinationCountry.slug,
            isoCode: application.destinationCountry.isoCode,
          }
        : undefined,
      visaType: application.visaType
        ? {
            id: application.visaType.id,
            purpose: application.visaType.purpose,
            // Entries feature — validity / max stay / entry label moved
            // to per-entry rows. For a specific application these ARE the
            // chosen entry's durations, so surface them here (keeps the
            // legacy visaType.{validityDays,maxStay,entries} shape working
            // instead of the now-dropped flat columns → undefined).
            validityDays: application.visaTypeEntry?.validityDays ?? 0,
            maxStay: application.visaTypeEntry?.maxStayDays ?? 0,
            entries: application.visaTypeEntry?.entryLabel ?? '',
            label: application.visaType.label,
          }
        : undefined,
      // Entries feature (Stage 4) — the chosen entry, surfaced explicitly
      // so admin list/detail + the apply review can show its label.
      visaTypeEntry: application.visaTypeEntry
        ? {
            id: application.visaTypeEntry.id,
            entryLabel: application.visaTypeEntry.entryLabel,
            validityDays: application.visaTypeEntry.validityDays,
            maxStayDays: application.visaTypeEntry.maxStayDays,
          }
        : undefined,
      template: application.template
        ? {
            id: application.template.id,
            name: application.template.name,
            key: application.template.key,
            version: application.template.version,
          }
        : undefined,
      applicants: application.applicants?.map((applicant: any) => ({
        id: applicant.id,
        isMainApplicant: applicant.isMainApplicant,
        email: applicant.email,
        phone: applicant.phone || undefined,
        formDataJson: applicant.formDataJson,
        status: applicant.status,
        applicationCode: applicant.applicationCode || undefined,
        // M11.8 (ISSUE 7) — surface uploaded documents on the
        // applicants payload so admin + portal detail pages can
        // render them. Field shape mirrors the standalone Document
        // endpoint so the frontend reuses the same renderer.
        documents: (applicant.documents ?? []).map((doc: any) => ({
          id: doc.id,
          documentTypeKey: doc.documentTypeKey,
          originalFileName: doc.originalFileName,
          storageFileName: doc.storageFileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          reviewStatus: doc.reviewStatus,
          reviewNote: doc.reviewNote ?? undefined,
          uploadedAt: doc.uploadedAt,
          reviewedAt: doc.reviewedAt ?? undefined,
        })),
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      })),
      // Payment rows — only present on the portal getApplication path
      // (the include adds `payments`); other paths omit it → undefined.
      // The payment page reads id + paymentStatus (resolve paymentId) and
      // expiresAt (countdown deadline).
      payments: application.payments?.map((p: any) => ({
        id: p.id,
        paymentStatus: p.paymentStatus,
        paymentProviderKey: p.paymentProviderKey,
        // Payment Stage 2 — gov/service/expedited split for admin display.
        governmentFeeAmount: p.governmentFeeAmount?.toString?.() ?? null,
        serviceFeeAmount: p.serviceFeeAmount?.toString?.() ?? null,
        expeditedFeeAmount: p.expeditedFeeAmount?.toString?.() ?? null,
        totalAmount: p.totalAmount?.toString?.() ?? null,
        payableAmount: p.payableAmount?.toString?.() ?? null,
        currencyCode: p.currencyCode,
        // Payment Stage 2 — lifecycle + per-portion refund markers.
        authorizedAt: p.authorizedAt ?? undefined,
        capturedAt: p.capturedAt ?? undefined,
        governmentFeeRefundedAt: p.governmentFeeRefundedAt ?? undefined,
        serviceFeeRefundedAt: p.serviceFeeRefundedAt ?? undefined,
        expiresAt: p.expiresAt ?? undefined,
        paidAt: p.paidAt ?? undefined,
        createdAt: p.createdAt,
      })),
      // M-Assign — surface the operator assignment so the admin
      // detail page sidebar (AssignmentAndNotesPanel) can render
      // the current assignee + powering the auth check on note
      // edit affordances. Cast through any since the auto-
      // generated ApplicationResponseDto wasn't extended this
      // sprint; the frontend reads `application.assignedToUser`.
      ...((): Record<string, unknown> => ({
        assignedToUser: application.assignedToUser
          ? {
              id: application.assignedToUser.id,
              fullName: application.assignedToUser.fullName,
              email: application.assignedToUser.email,
            }
          : null,
        assignedAt: application.assignedAt ?? null,
        assignedBy: application.assignedByUser
          ? {
              id: application.assignedByUser.id,
              fullName: application.assignedByUser.fullName,
              email: application.assignedByUser.email,
            }
          : null,
      }))(),
      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  /**
   * Module 9 — admin updates the SLA estimate for an application.
   * Every change writes an `application_estimated_time_changes` row
   * (so customer-facing UIs can show the trail) AND emits an
   * `application.estimated_time.update` audit entry. `reason` is
   * required at the DTO level.
   */
  async updateEstimatedTime(
    applicationId: string,
    userId: string,
    dto: UpdateEstimatedTimeDto,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
    });
    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application does not exist or has been deleted' },
      ]);
    }

    const oldDays = application.estimatedProcessingDays;
    if (oldDays === dto.estimatedDays) {
      // No-op short circuit — same value, skip the audit + history row.
      return this.findById(applicationId);
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: applicationId },
        data: {
          estimatedProcessingDays: dto.estimatedDays,
          estimatedTimeUpdatedAt: now,
        },
      }),
      this.prisma.applicationEstimatedTimeChange.create({
        data: {
          applicationId,
          oldDays,
          newDays: dto.estimatedDays,
          reason: dto.reason,
          changedByUserId: userId,
        },
      }),
    ]);

    await this.auditLogsService.logAdminAction(
      userId,
      'application.estimated_time.update',
      'Application',
      applicationId,
      { estimatedProcessingDays: oldDays },
      { estimatedProcessingDays: dto.estimatedDays, reason: dto.reason },
    );

    this.logger.log(
      `Estimated time for application ${applicationId}: ${oldDays ?? '(unset)'} → ${dto.estimatedDays} (${dto.reason})`,
    );

    return this.findById(applicationId);
  }

  /**
   * Module 9 — full estimated-time change history (newest first).
   * Each row includes the actor's name + email so the admin UI can
   * render "by Anar — 5m ago" without a second user lookup.
   */
  async getEstimatedTimeChanges(
    applicationId: string,
  ): Promise<EstimatedTimeChangeEntryDto[]> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { id: true },
    });
    if (!application) {
      throw new NotFoundException('Application not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Application does not exist or has been deleted' },
      ]);
    }

    const rows = await this.prisma.applicationEstimatedTimeChange.findMany({
      where: { applicationId },
      orderBy: { createdAt: 'desc' },
      include: {
        changedByUser: { select: { id: true, fullName: true, email: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      oldDays: r.oldDays,
      newDays: r.newDays,
      reason: r.reason,
      changedByUserId: r.changedByUserId,
      changedByUser: r.changedByUser
        ? {
            id: r.changedByUser.id,
            fullName: r.changedByUser.fullName,
            email: r.changedByUser.email,
          }
        : null,
      createdAt: r.createdAt,
    }));
  }

  /**
   * M11.10 (BUG 4) — Generate next REF-YYYY-NNNNNN booking code.
   *
   * Mirrors the M11.6 application code generator's defensive
   * pattern: scan a recent window of rows for the current year,
   * filter to numeric-only suffixes (a corrupt legacy code shouldn't
   * NaN-poison the max), pick max+1, retry on P2002 unique
   * collisions (race between two concurrent submissions).
   */
  private async generateReferenceCode(offset = 0): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `REF-${year}-`;
    const recent = await this.prisma.application.findMany({
      where: {
        referenceCode: { startsWith: prefix },
        // NO `deletedAt` filter — deliberately.
        //
        // 2026-08-08 prod incident: this scan filtered `deletedAt: null`
        // while the unique index on `reference_code` covers EVERY row,
        // soft-deleted included. REF-2026-000005 had been soft-deleted
        // by the old timeout sweep, so the scan saw max 000004, produced
        // 000005, and every application create 500'd on P2002. The scan
        // must see exactly what the index enforces.
      },
      select: { referenceCode: true },
      // Order by the code itself, not createdAt: the suffix is
      // zero-padded to a fixed width, so lexical desc == numeric desc,
      // and the highest codes are guaranteed to be inside the window
      // even if rows were backdated or imported out of order.
      orderBy: { referenceCode: 'desc' },
      take: 200,
    });

    let maxNum = 0;
    for (const row of recent) {
      const code = row.referenceCode;
      if (!code) continue;
      const suffix = code.slice(prefix.length);
      const numMatch = suffix.match(/^\d+$/);
      if (!numMatch) continue;
      const n = parseInt(suffix, 10);
      if (Number.isFinite(n) && n > maxNum) maxNum = n;
    }
    // `offset` is the retry count. Without it a retry re-runs the same
    // query against the same data and hands back the identical code, so
    // all attempts fail for one reason — which is exactly how a single
    // stale row took down application creation.
    const nextNumber = maxNum + 1 + offset;
    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  private async withReferenceCodeRetry<T>(
    operation: (referenceCode: string) => Promise<T>,
    maxAttempts = 5,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Each retry asks for the next number up, so a genuine race
      // (two submissions landing on the same code) resolves instead of
      // re-colliding on the same candidate five times.
      const referenceCode = await this.generateReferenceCode(attempt - 1);
      try {
        return await operation(referenceCode);
      } catch (err) {
        lastError = err;
        // Prisma P2002 = unique constraint violation. Retry with a
        // fresh code; any other error bubbles immediately.
        const code = (err as any)?.code;
        if (code !== 'P2002') throw err;
        this.logger.warn(
          `[BUG 4] referenceCode collision on ${referenceCode} (attempt ${attempt}/${maxAttempts}); retrying`,
        );
      }
    }
    throw lastError;
  }
}
