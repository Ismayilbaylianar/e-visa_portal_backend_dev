import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  UpdateApplicantStatusDto,
  ApplicantResponseDto,
  DocumentResponseDto,
} from './dto';
import { NotFoundException, ForbiddenException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { ApplicantStatus, ApplicationStatus } from '@/common/enums';

@Injectable()
export class ApplicantsService {
  private readonly logger = new Logger(ApplicantsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
   * Update applicant status (admin only)
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

    const [updatedApplicant] = await this.prisma.$transaction([
      this.prisma.applicationApplicant.update({
        where: { id: applicantId },
        data: { status: dto.status },
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

    this.logger.log(`Applicant status updated: ${applicantId} from ${oldStatus} to ${dto.status}`);
    return this.mapToResponse(updatedApplicant);
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
