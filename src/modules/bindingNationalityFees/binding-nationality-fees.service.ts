import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBindingNationalityFeeDto,
  UpdateBindingNationalityFeeDto,
  BindingNationalityFeeResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BindingNationalityFeesService {
  private readonly logger = new Logger(BindingNationalityFeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    bindingId: string,
    dto: CreateBindingNationalityFeeDto,
  ): Promise<BindingNationalityFeeResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id: bindingId, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found');
    }

    const existingFee = await this.prisma.bindingNationalityFee.findFirst({
      where: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        deletedAt: null,
      },
    });

    if (existingFee) {
      throw new ConflictException(
        'A fee already exists for this nationality in this binding',
      );
    }

    const nationalityCountry = await this.prisma.country.findFirst({
      where: { id: dto.nationalityCountryId, deletedAt: null },
    });

    if (!nationalityCountry) {
      throw new NotFoundException('Nationality country not found');
    }

    const fee = await this.prisma.bindingNationalityFee.create({
      data: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        governmentFeeAmount: new Decimal(dto.governmentFeeAmount),
        serviceFeeAmount: new Decimal(dto.serviceFeeAmount),
        expeditedFeeAmount: dto.expeditedFeeAmount
          ? new Decimal(dto.expeditedFeeAmount)
          : null,
        currencyCode: dto.currencyCode,
        expeditedEnabled: dto.expeditedEnabled ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    this.logger.log(`Binding nationality fee created: ${fee.id}`);
    return this.mapToResponse(fee);
  }

  async update(
    feeId: string,
    dto: UpdateBindingNationalityFeeDto,
  ): Promise<BindingNationalityFeeResponseDto> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found');
    }

    if (dto.nationalityCountryId && dto.nationalityCountryId !== fee.nationalityCountryId) {
      const existingFee = await this.prisma.bindingNationalityFee.findFirst({
        where: {
          templateBindingId: fee.templateBindingId,
          nationalityCountryId: dto.nationalityCountryId,
          deletedAt: null,
          NOT: { id: feeId },
        },
      });

      if (existingFee) {
        throw new ConflictException(
          'A fee already exists for this nationality in this binding',
        );
      }

      const nationalityCountry = await this.prisma.country.findFirst({
        where: { id: dto.nationalityCountryId, deletedAt: null },
      });

      if (!nationalityCountry) {
        throw new NotFoundException('Nationality country not found');
      }
    }

    const updatedFee = await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: {
        ...(dto.nationalityCountryId && {
          nationalityCountryId: dto.nationalityCountryId,
        }),
        ...(dto.governmentFeeAmount !== undefined && {
          governmentFeeAmount: new Decimal(dto.governmentFeeAmount),
        }),
        ...(dto.serviceFeeAmount !== undefined && {
          serviceFeeAmount: new Decimal(dto.serviceFeeAmount),
        }),
        ...(dto.expeditedFeeAmount !== undefined && {
          expeditedFeeAmount: dto.expeditedFeeAmount
            ? new Decimal(dto.expeditedFeeAmount)
            : null,
        }),
        ...(dto.currencyCode && { currencyCode: dto.currencyCode }),
        ...(dto.expeditedEnabled !== undefined && {
          expeditedEnabled: dto.expeditedEnabled,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    this.logger.log(`Binding nationality fee updated: ${feeId}`);
    return this.mapToResponse(updatedFee);
  }

  async delete(feeId: string): Promise<void> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found');
    }

    await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Binding nationality fee deleted: ${feeId}`);
  }

  private mapToResponse(fee: any): BindingNationalityFeeResponseDto {
    const response: BindingNationalityFeeResponseDto = {
      id: fee.id,
      templateBindingId: fee.templateBindingId,
      nationalityCountryId: fee.nationalityCountryId,
      governmentFeeAmount: fee.governmentFeeAmount.toString(),
      serviceFeeAmount: fee.serviceFeeAmount.toString(),
      expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || undefined,
      currencyCode: fee.currencyCode,
      expeditedEnabled: fee.expeditedEnabled,
      isActive: fee.isActive,
      createdAt: fee.createdAt,
      updatedAt: fee.updatedAt,
    };

    if (fee.nationalityCountry) {
      response.nationalityCountry = {
        id: fee.nationalityCountry.id,
        name: fee.nationalityCountry.name,
        isoCode: fee.nationalityCountry.isoCode,
      };
    }

    return response;
  }
}
