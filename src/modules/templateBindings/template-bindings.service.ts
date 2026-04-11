import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateBindingDto,
  UpdateTemplateBindingDto,
  TemplateBindingResponseDto,
  TemplateBindingListItemResponseDto,
  GetTemplateBindingsQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class TemplateBindingsService {
  private readonly logger = new Logger(TemplateBindingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of template bindings (summary view)
   */
  async findAll(
    query: GetTemplateBindingsQueryDto,
  ): Promise<{ items: TemplateBindingListItemResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.destinationCountryId && { destinationCountryId: query.destinationCountryId }),
      ...(query.visaTypeId && { visaTypeId: query.visaTypeId }),
      ...(query.templateId && { templateId: query.templateId }),
    };

    const [bindings, total] = await Promise.all([
      this.prisma.templateBinding.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          destinationCountry: {
            select: { id: true, name: true, isoCode: true },
          },
          visaType: {
            select: { id: true, label: true, purpose: true },
          },
          template: {
            select: { id: true, name: true, key: true },
          },
          _count: {
            select: {
              nationalityFees: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.templateBinding.count({ where }),
    ]);

    const items = bindings.map(binding => this.mapToListItemResponse(binding));

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

  /**
   * Get template binding by ID with full details including nationality fees
   */
  async findById(id: string): Promise<TemplateBindingResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
      include: {
        destinationCountry: {
          select: { id: true, name: true, isoCode: true },
        },
        visaType: {
          select: { id: true, label: true, purpose: true },
        },
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: { deletedAt: null },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
          orderBy: {
            nationalityCountry: { name: 'asc' },
          },
        },
      },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(binding);
  }

  /**
   * Create a new template binding
   * Duplicate rule: Only one active binding allowed per destinationCountryId + visaTypeId
   */
  async create(dto: CreateTemplateBindingDto): Promise<TemplateBindingResponseDto> {
    // Check for duplicate binding (same destination + visa type)
    const existingBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        deletedAt: null,
      },
    });

    if (existingBinding) {
      throw new ConflictException('Template binding already exists', [
        {
          reason: ErrorCodes.CONFLICT,
          message:
            'A template binding already exists for this destination country and visa type combination',
        },
      ]);
    }

    await this.validateRelations(dto);

    const binding = await this.prisma.templateBinding.create({
      data: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        templateId: dto.templateId,
        isActive: dto.isActive ?? true,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validTo: dto.validTo ? new Date(dto.validTo) : null,
      },
      include: {
        destinationCountry: {
          select: { id: true, name: true, isoCode: true },
        },
        visaType: {
          select: { id: true, label: true, purpose: true },
        },
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: { deletedAt: null },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
        },
      },
    });

    this.logger.log(`Template binding created: ${binding.id}`);
    return this.mapToResponse(binding);
  }

  /**
   * Update template binding
   */
  async update(id: string, dto: UpdateTemplateBindingDto): Promise<TemplateBindingResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate if changing destination or visa type
    if (dto.destinationCountryId || dto.visaTypeId) {
      const destinationCountryId = dto.destinationCountryId || binding.destinationCountryId;
      const visaTypeId = dto.visaTypeId || binding.visaTypeId;

      const existingBinding = await this.prisma.templateBinding.findFirst({
        where: {
          destinationCountryId,
          visaTypeId,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existingBinding) {
        throw new ConflictException('Template binding already exists', [
          {
            reason: ErrorCodes.CONFLICT,
            message:
              'A template binding already exists for this destination country and visa type combination',
          },
        ]);
      }
    }

    await this.validateRelations(dto);

    const updateData: any = {};
    if (dto.destinationCountryId !== undefined)
      updateData.destinationCountryId = dto.destinationCountryId;
    if (dto.visaTypeId !== undefined) updateData.visaTypeId = dto.visaTypeId;
    if (dto.templateId !== undefined) updateData.templateId = dto.templateId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.validFrom !== undefined)
      updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) updateData.validTo = dto.validTo ? new Date(dto.validTo) : null;

    const updatedBinding = await this.prisma.templateBinding.update({
      where: { id },
      data: updateData,
      include: {
        destinationCountry: {
          select: { id: true, name: true, isoCode: true },
        },
        visaType: {
          select: { id: true, label: true, purpose: true },
        },
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: { deletedAt: null },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
          orderBy: {
            nationalityCountry: { name: 'asc' },
          },
        },
      },
    });

    this.logger.log(`Template binding updated: ${id}`);
    return this.mapToResponse(updatedBinding);
  }

  /**
   * Soft delete template binding and all its nationality fees
   */
  async delete(id: string): Promise<void> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    const now = new Date();

    await this.prisma.$transaction([
      // Soft delete all nationality fees
      this.prisma.bindingNationalityFee.updateMany({
        where: { templateBindingId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Soft delete binding
      this.prisma.templateBinding.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    this.logger.log(`Template binding soft deleted: ${id}`);
  }

  /**
   * Find active binding for public selection (with date validity check)
   */
  async findActiveBinding(destinationCountryId: string, visaTypeId: string): Promise<any | null> {
    const now = new Date();

    return this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId,
        visaTypeId,
        isActive: true,
        deletedAt: null,
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [
          {
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
        ],
      },
      include: {
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
        },
      },
    });
  }

  private async validateRelations(
    dto: CreateTemplateBindingDto | UpdateTemplateBindingDto,
  ): Promise<void> {
    if (dto.destinationCountryId) {
      const country = await this.prisma.country.findFirst({
        where: { id: dto.destinationCountryId, deletedAt: null },
      });
      if (!country) {
        throw new NotFoundException('Destination country not found', [
          {
            reason: ErrorCodes.COUNTRY_NOT_FOUND,
            message: 'Destination country does not exist or has been deleted',
          },
        ]);
      }
    }

    if (dto.visaTypeId) {
      const visaType = await this.prisma.visaType.findFirst({
        where: { id: dto.visaTypeId, deletedAt: null },
      });
      if (!visaType) {
        throw new NotFoundException('Visa type not found', [
          {
            reason: ErrorCodes.VISA_TYPE_NOT_FOUND,
            message: 'Visa type does not exist or has been deleted',
          },
        ]);
      }
    }

    if (dto.templateId) {
      const template = await this.prisma.template.findFirst({
        where: { id: dto.templateId, deletedAt: null },
      });
      if (!template) {
        throw new NotFoundException('Template not found', [
          {
            reason: ErrorCodes.TEMPLATE_NOT_FOUND,
            message: 'Template does not exist or has been deleted',
          },
        ]);
      }
    }
  }

  private mapToListItemResponse(binding: any): TemplateBindingListItemResponseDto {
    return {
      id: binding.id,
      destinationCountryId: binding.destinationCountryId,
      visaTypeId: binding.visaTypeId,
      templateId: binding.templateId,
      isActive: binding.isActive,
      validFrom: binding.validFrom || null,
      validTo: binding.validTo || null,
      nationalityFeesCount: binding._count?.nationalityFees ?? 0,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
      destinationCountry: binding.destinationCountry
        ? {
            id: binding.destinationCountry.id,
            name: binding.destinationCountry.name,
            isoCode: binding.destinationCountry.isoCode,
          }
        : undefined,
      visaType: binding.visaType
        ? {
            id: binding.visaType.id,
            label: binding.visaType.label,
            purpose: binding.visaType.purpose,
          }
        : undefined,
      template: binding.template
        ? {
            id: binding.template.id,
            name: binding.template.name,
            key: binding.template.key,
          }
        : undefined,
    };
  }

  private mapToResponse(binding: any): TemplateBindingResponseDto {
    return {
      id: binding.id,
      destinationCountryId: binding.destinationCountryId,
      visaTypeId: binding.visaTypeId,
      templateId: binding.templateId,
      isActive: binding.isActive,
      validFrom: binding.validFrom || null,
      validTo: binding.validTo || null,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
      destinationCountry: binding.destinationCountry
        ? {
            id: binding.destinationCountry.id,
            name: binding.destinationCountry.name,
            isoCode: binding.destinationCountry.isoCode,
          }
        : undefined,
      visaType: binding.visaType
        ? {
            id: binding.visaType.id,
            label: binding.visaType.label,
            purpose: binding.visaType.purpose,
          }
        : undefined,
      template: binding.template
        ? {
            id: binding.template.id,
            name: binding.template.name,
            key: binding.template.key,
          }
        : undefined,
      nationalityFees: (binding.nationalityFees || []).map((fee: any) => ({
        id: fee.id,
        nationalityCountryId: fee.nationalityCountryId,
        nationalityCountry: fee.nationalityCountry
          ? {
              id: fee.nationalityCountry.id,
              name: fee.nationalityCountry.name,
              isoCode: fee.nationalityCountry.isoCode,
            }
          : undefined,
        governmentFeeAmount: fee.governmentFeeAmount.toString(),
        serviceFeeAmount: fee.serviceFeeAmount.toString(),
        expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || null,
        currencyCode: fee.currencyCode,
        expeditedEnabled: fee.expeditedEnabled,
        isActive: fee.isActive,
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt,
      })),
    };
  }
}
