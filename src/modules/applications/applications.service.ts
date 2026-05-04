import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { EmailService } from '../email/email.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
  ApproveApplicationDto,
  RejectApplicationDto,
  RequestDocumentsDto,
  UpdateEstimatedTimeDto,
  EstimatedTimeChangeEntryDto,
} from './dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '@/common/exceptions';
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
    const application = await this.prisma.application.findFirst({
      where: { id, deletedAt: null },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
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
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
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
        nationalityFees: {
          where: {
            nationalityCountryId: dto.nationalityCountryId,
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

    const governmentFee = Number(nationalityFee.governmentFeeAmount);
    const serviceFee = Number(nationalityFee.serviceFeeAmount);
    const expeditedFee =
      dto.expedited && nationalityFee.expeditedEnabled
        ? Number(nationalityFee.expeditedFeeAmount || 0)
        : 0;

    const totalFeeAmount = governmentFee + serviceFee + expeditedFee;

    const application = await this.prisma.application.create({
      data: {
        portalIdentityId,
        nationalityCountryId: dto.nationalityCountryId,
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
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
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

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
        const governmentFee = Number(nationalityFee.governmentFeeAmount);
        const serviceFee = Number(nationalityFee.serviceFeeAmount);
        const expeditedFee =
          dto.expedited && nationalityFee.expeditedEnabled
            ? Number(nationalityFee.expeditedFeeAmount || 0)
            : 0;

        totalFeeAmount = governmentFee + serviceFee + expeditedFee;
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

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.UNPAID;

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        paymentDeadlineAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours
      },
      include: {
        portalIdentity: true,
        nationalityCountry: true,
        destinationCountry: true,
        visaType: true,
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

    this.logger.log(`Application submitted for review: ${id}`);
    return this.mapToResponse(updatedApplication);
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

    // Temporary behavior: Allow submission from UNPAID status (payment not implemented yet)
    // In production, this should check: application.paymentStatus === PaymentStatus.PAID
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
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!application) {
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

    return this.mapToResponse(application);
  }

  // =====================
  // Admin Review Actions
  // =====================

  /**
   * Valid statuses that can be approved
   */
  private readonly APPROVABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.IN_REVIEW,
  ];

  /**
   * Valid statuses that can be rejected
   */
  private readonly REJECTABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.IN_REVIEW,
    ApplicationStatus.NEED_DOCS,
  ];

  /**
   * Valid statuses that can have documents requested
   */
  private readonly DOCS_REQUESTABLE_STATUSES: ApplicationStatus[] = [
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.IN_REVIEW,
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
          message: `Application in ${application.currentStatus} status cannot be approved. Must be in SUBMITTED or IN_REVIEW status.`,
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
          message: `Application in ${application.currentStatus} status cannot be rejected.`,
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.REJECTED;

    // Update application status
    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        reviewedAt: new Date(),
        reviewedByUserId: adminUserId,
        adminNote: dto.reason,
        rejectionReason: dto.reason,
      },
      include: this.getApplicationIncludes(),
    });

    // Create status history
    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: dto.reason,
        changedByUserId: adminUserId,
        changedBySystem: false,
      },
    });

    // Audit log
    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.reject',
      'Application',
      id,
      { status: oldStatus },
      { status: newStatus, reason: dto.reason },
    );

    // Send notification email
    await this.sendStatusNotificationEmail(
      updatedApplication,
      'Rejected',
      dto.reason,
    );

    this.logger.log(`Application rejected: ${id} by admin ${adminUserId}`);
    return this.mapToResponse(updatedApplication);
  }

  /**
   * Request additional documents for an application (Admin)
   */
  async requestDocuments(
    id: string,
    dto: RequestDocumentsDto,
    adminUserId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    // Validate status transition
    if (!this.DOCS_REQUESTABLE_STATUSES.includes(application.currentStatus as ApplicationStatus)) {
      throw new BadRequestException('Cannot request documents for this application', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Application in ${application.currentStatus} status cannot have documents requested.`,
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.NEED_DOCS;

    // Update application status
    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        adminNote: dto.note,
        requestedDocumentTypes: dto.documentTypeKeys || [],
      },
      include: this.getApplicationIncludes(),
    });

    // Create status history
    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: dto.note,
        changedByUserId: adminUserId,
        changedBySystem: false,
      },
    });

    // Audit log
    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.request_documents',
      'Application',
      id,
      { status: oldStatus },
      { status: newStatus, note: dto.note, documentTypeKeys: dto.documentTypeKeys },
    );

    // Send notification email
    await this.sendStatusNotificationEmail(
      updatedApplication,
      'Additional Documents Required',
      dto.note,
    );

    this.logger.log(`Documents requested for application: ${id} by admin ${adminUserId}`);
    return this.mapToResponse(updatedApplication);
  }

  /**
   * Move application to IN_REVIEW status (Admin)
   */
  async startReview(id: string, adminUserId: string): Promise<ApplicationResponseDto> {
    const application = await this.getApplicationWithRelations(id);

    if (application.currentStatus !== ApplicationStatus.SUBMITTED) {
      throw new BadRequestException('Application cannot be moved to review', [
        {
          reason: ErrorCodes.INVALID_STATUS_TRANSITION,
          message: `Only SUBMITTED applications can be moved to IN_REVIEW status.`,
        },
      ]);
    }

    const oldStatus = application.currentStatus;
    const newStatus = ApplicationStatus.IN_REVIEW;

    const updatedApplication = await this.prisma.application.update({
      where: { id },
      data: {
        currentStatus: newStatus,
        reviewedByUserId: adminUserId,
      },
      include: this.getApplicationIncludes(),
    });

    await this.prisma.applicationStatusHistory.create({
      data: {
        applicationId: id,
        oldStatus,
        newStatus,
        note: 'Application review started',
        changedByUserId: adminUserId,
        changedBySystem: false,
      },
    });

    await this.auditLogsService.logAdminAction(
      adminUserId,
      'application.start_review',
      'Application',
      id,
      { status: oldStatus },
      { status: newStatus },
    );

    this.logger.log(`Application review started: ${id} by admin ${adminUserId}`);
    return this.mapToResponse(updatedApplication);
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
        template: true,
        applicants: {
          where: { deletedAt: null },
          orderBy: [{ isMainApplicant: 'desc' }, { createdAt: 'asc' }],
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
      template: true,
      applicants: {
        where: { deletedAt: null },
        orderBy: [{ isMainApplicant: 'desc' as const }, { createdAt: 'asc' as const }],
      },
    };
  }

  /**
   * Send status notification email to applicant
   */
  private async sendStatusNotificationEmail(
    application: any,
    statusLabel: string,
    notes?: string,
  ): Promise<void> {
    if (!application.portalIdentity?.email) {
      this.logger.warn(`No email found for application ${application.id}`);
      return;
    }

    try {
      const applicationRef = application.code || application.id.slice(0, 8).toUpperCase();
      await this.emailService.sendApplicationStatusEmail(
        application.portalIdentity.email,
        applicationRef,
        statusLabel,
        notes,
      );
      this.logger.log(`Status notification email sent for application ${application.id}`);
    } catch (error) {
      this.logger.error(`Failed to send status notification email: ${error}`);
    }
  }

  private mapToResponse(application: any): ApplicationResponseDto {
    return {
      id: application.id,
      portalIdentityId: application.portalIdentityId,
      nationalityCountryId: application.nationalityCountryId,
      destinationCountryId: application.destinationCountryId,
      visaTypeId: application.visaTypeId,
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
            validityDays: application.visaType.validityDays,
            maxStay: application.visaType.maxStay,
            entries: application.visaType.entries,
            label: application.visaType.label,
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
        createdAt: applicant.createdAt,
        updatedAt: applicant.updatedAt,
      })),
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
}
