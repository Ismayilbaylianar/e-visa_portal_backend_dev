import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  ApplicationResponseDto,
  GetApplicationsQueryDto,
} from './dto';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';
import { ApplicationStatus, PaymentStatus } from '@/common/enums';
import { randomBytes } from 'crypto';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.mapToResponse(application);
  }

  async findByIdForPortal(
    id: string,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, portalIdentityId, deletedAt: null },
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

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.mapToResponse(application);
  }

  async create(
    dto: CreateApplicationDto,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        isActive: true,
        deletedAt: null,
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
      throw new BadRequestException(
        'No active template binding found for this destination and visa type combination',
      );
    }

    const nationalityFee = templateBinding.nationalityFees[0];
    if (!nationalityFee) {
      throw new BadRequestException(
        'No fee configuration found for this nationality',
      );
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

    this.logger.log(`Application created: ${application.id}`);
    return this.mapToResponse(application);
  }

  async update(
    id: string,
    dto: UpdateApplicationDto,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, portalIdentityId, deletedAt: null },
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
      throw new NotFoundException('Application not found');
    }

    if (application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft applications can be updated',
      );
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

  async submitForReview(
    id: string,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, portalIdentityId, deletedAt: null },
      include: {
        applicants: {
          where: { deletedAt: null },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.currentStatus !== ApplicationStatus.DRAFT) {
      throw new BadRequestException(
        'Only draft applications can be submitted for review',
      );
    }

    if (application.applicants.length === 0) {
      throw new BadRequestException(
        'Application must have at least one applicant',
      );
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

    this.logger.log(`Application submitted for review: ${id}`);
    return this.mapToResponse(updatedApplication);
  }

  async submit(
    id: string,
    portalIdentityId: string,
  ): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, portalIdentityId, deletedAt: null },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Payment must be completed before submitting the application',
      );
    }

    if (application.currentStatus !== ApplicationStatus.UNPAID) {
      throw new BadRequestException(
        'Application is not in the correct state for submission',
      );
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

    this.logger.log(`Application submitted: ${id}`);
    return this.mapToResponse(updatedApplication);
  }

  async getByResumeToken(resumeToken: string): Promise<ApplicationResponseDto> {
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return this.mapToResponse(application);
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
}
