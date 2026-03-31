import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateApplicantDto,
  UpdateApplicantDto,
  UpdateApplicantStatusDto,
  ApplicantResponseDto,
  DocumentResponseDto,
} from './dto';
import { NotFoundException, ForbiddenException } from '@/common/exceptions';
import { ApplicantStatus } from '@/common/enums';

@Injectable()
export class ApplicantsService {
  private readonly logger = new Logger(ApplicantsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException('Application not found');
    }

    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this application');
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
  async findById(
    applicantId: string,
    portalIdentityId: string,
  ): Promise<ApplicantResponseDto> {
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
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this applicant');
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
      throw new NotFoundException('Applicant not found');
    }

    return this.mapToResponse(applicant);
  }

  /**
   * Create new applicant under an application
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
      throw new NotFoundException('Application not found');
    }

    if (application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this application');
    }

    if (dto.isMainApplicant) {
      const existingMain = await this.prisma.applicationApplicant.findFirst({
        where: {
          applicationId,
          isMainApplicant: true,
          deletedAt: null,
        },
      });

      if (existingMain) {
        throw new ForbiddenException(
          'Application already has a main applicant',
        );
      }
    }

    const applicant = await this.prisma.applicationApplicant.create({
      data: {
        applicationId,
        isMainApplicant: dto.isMainApplicant,
        email: dto.email,
        phone: dto.phone,
        formDataJson: dto.formDataJson,
        status: ApplicantStatus.DRAFT,
      },
      include: {
        documents: {
          where: { deletedAt: null },
        },
      },
    });

    this.logger.log(
      `Applicant created: ${applicant.id} for application: ${applicationId}`,
    );
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
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this applicant');
    }

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
        throw new ForbiddenException(
          'Application already has a main applicant',
        );
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
      throw new NotFoundException('Applicant not found');
    }

    if (applicant.application.portalIdentityId !== portalIdentityId) {
      throw new ForbiddenException('Access denied to this applicant');
    }

    await this.prisma.applicationApplicant.update({
      where: { id: applicantId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Applicant deleted: ${applicantId}`);
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
      throw new NotFoundException('Applicant not found');
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

    this.logger.log(
      `Applicant status updated: ${applicantId} from ${oldStatus} to ${dto.status}`,
    );
    return this.mapToResponse(updatedApplicant);
  }

  private mapToResponse(applicant: any): ApplicantResponseDto {
    const documents: DocumentResponseDto[] | undefined = applicant.documents?.map(
      (doc: any) => ({
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
      }),
    );

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
      requiredDocumentsJson:
        (applicant.requiredDocumentsJson as Record<string, any>) || undefined,
      additionalDocsRequestedJson:
        (applicant.additionalDocsRequestedJson as Record<string, any>) ||
        undefined,
      documents,
      createdAt: applicant.createdAt,
      updatedAt: applicant.updatedAt,
    };
  }
}
