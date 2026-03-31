import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateBindingDto,
  UpdateTemplateBindingDto,
  TemplateBindingResponseDto,
  GetTemplateBindingsQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class TemplateBindingsService {
  private readonly logger = new Logger(TemplateBindingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetTemplateBindingsQueryDto,
  ): Promise<{ items: TemplateBindingResponseDto[]; pagination: PaginationMeta }> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeRelations = false,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.destinationCountryId && { destinationCountryId: query.destinationCountryId }),
      ...(query.visaTypeId && { visaTypeId: query.visaTypeId }),
      ...(query.templateId && { templateId: query.templateId }),
    };

    const include = includeRelations
      ? {
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
            select: {
              id: true,
              nationalityCountryId: true,
              governmentFeeAmount: true,
              serviceFeeAmount: true,
              expeditedFeeAmount: true,
              currencyCode: true,
              expeditedEnabled: true,
              isActive: true,
            },
          },
        }
      : undefined;

    const [bindings, total] = await Promise.all([
      this.prisma.templateBinding.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include,
      }),
      this.prisma.templateBinding.count({ where }),
    ]);

    const items = bindings.map(binding => this.mapToResponse(binding, includeRelations));

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

  async findById(id: string, includeRelations = true): Promise<TemplateBindingResponseDto> {
    const include = includeRelations
      ? {
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
            select: {
              id: true,
              nationalityCountryId: true,
              governmentFeeAmount: true,
              serviceFeeAmount: true,
              expeditedFeeAmount: true,
              currencyCode: true,
              expeditedEnabled: true,
              isActive: true,
            },
          },
        }
      : undefined;

    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
      include,
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found');
    }

    return this.mapToResponse(binding, includeRelations);
  }

  async create(dto: CreateTemplateBindingDto): Promise<TemplateBindingResponseDto> {
    const existingBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        deletedAt: null,
      },
    });

    if (existingBinding) {
      throw new ConflictException(
        'A template binding already exists for this destination country and visa type combination',
      );
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
      },
    });

    this.logger.log(`Template binding created: ${binding.id}`);
    return this.mapToResponse(binding, true);
  }

  async update(id: string, dto: UpdateTemplateBindingDto): Promise<TemplateBindingResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found');
    }

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
        throw new ConflictException(
          'A template binding already exists for this destination country and visa type combination',
        );
      }
    }

    await this.validateRelations(dto);

    const updatedBinding = await this.prisma.templateBinding.update({
      where: { id },
      data: {
        ...(dto.destinationCountryId && { destinationCountryId: dto.destinationCountryId }),
        ...(dto.visaTypeId && { visaTypeId: dto.visaTypeId }),
        ...(dto.templateId && { templateId: dto.templateId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.validFrom !== undefined && {
          validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        }),
        ...(dto.validTo !== undefined && {
          validTo: dto.validTo ? new Date(dto.validTo) : null,
        }),
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
      },
    });

    this.logger.log(`Template binding updated: ${id}`);
    return this.mapToResponse(updatedBinding, true);
  }

  async delete(id: string): Promise<void> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found');
    }

    await this.prisma.templateBinding.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Template binding deleted: ${id}`);
  }

  private async validateRelations(
    dto: CreateTemplateBindingDto | UpdateTemplateBindingDto,
  ): Promise<void> {
    if (dto.destinationCountryId) {
      const country = await this.prisma.country.findFirst({
        where: { id: dto.destinationCountryId, deletedAt: null },
      });
      if (!country) {
        throw new NotFoundException('Destination country not found');
      }
    }

    if (dto.visaTypeId) {
      const visaType = await this.prisma.visaType.findFirst({
        where: { id: dto.visaTypeId, deletedAt: null },
      });
      if (!visaType) {
        throw new NotFoundException('Visa type not found');
      }
    }

    if (dto.templateId) {
      const template = await this.prisma.template.findFirst({
        where: { id: dto.templateId, deletedAt: null },
      });
      if (!template) {
        throw new NotFoundException('Template not found');
      }
    }
  }

  private mapToResponse(binding: any, includeRelations = false): TemplateBindingResponseDto {
    const response: TemplateBindingResponseDto = {
      id: binding.id,
      destinationCountryId: binding.destinationCountryId,
      visaTypeId: binding.visaTypeId,
      templateId: binding.templateId,
      isActive: binding.isActive,
      validFrom: binding.validFrom || undefined,
      validTo: binding.validTo || undefined,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
    };

    if (includeRelations) {
      if (binding.destinationCountry) {
        response.destinationCountry = {
          id: binding.destinationCountry.id,
          name: binding.destinationCountry.name,
          isoCode: binding.destinationCountry.isoCode,
        };
      }

      if (binding.visaType) {
        response.visaType = {
          id: binding.visaType.id,
          label: binding.visaType.label,
          purpose: binding.visaType.purpose,
        };
      }

      if (binding.template) {
        response.template = {
          id: binding.template.id,
          name: binding.template.name,
          key: binding.template.key,
        };
      }

      if (binding.nationalityFees) {
        response.nationalityFees = binding.nationalityFees.map((fee: any) => ({
          id: fee.id,
          nationalityCountryId: fee.nationalityCountryId,
          governmentFeeAmount: fee.governmentFeeAmount.toString(),
          serviceFeeAmount: fee.serviceFeeAmount.toString(),
          expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || undefined,
          currencyCode: fee.currencyCode,
          expeditedEnabled: fee.expeditedEnabled,
          isActive: fee.isActive,
        }));
      }
    }

    return response;
  }
}
