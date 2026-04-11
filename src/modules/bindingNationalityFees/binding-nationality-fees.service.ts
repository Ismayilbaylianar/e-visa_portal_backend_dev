import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBindingNationalityFeeDto,
  UpdateBindingNationalityFeeDto,
  BindingNationalityFeeResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BindingNationalityFeesService {
  private readonly logger = new Logger(BindingNationalityFeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new nationality fee for a template binding
   * Nationality must be unique within the binding
   */
  async create(
    bindingId: string,
    dto: CreateBindingNationalityFeeDto,
  ): Promise<BindingNationalityFeeResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id: bindingId, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate nationality within binding
    const existingFee = await this.prisma.bindingNationalityFee.findFirst({
      where: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        deletedAt: null,
      },
    });

    if (existingFee) {
      throw new ConflictException('Nationality fee already exists', [
        {
          field: 'nationalityCountryId',
          reason: ErrorCodes.CONFLICT,
          message: 'A fee already exists for this nationality in this binding',
        },
      ]);
    }

    // Validate nationality country exists
    const nationalityCountry = await this.prisma.country.findFirst({
      where: { id: dto.nationalityCountryId, deletedAt: null },
    });

    if (!nationalityCountry) {
      throw new NotFoundException('Nationality country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Nationality country does not exist or has been deleted',
        },
      ]);
    }

    const fee = await this.prisma.bindingNationalityFee.create({
      data: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        governmentFeeAmount: new Decimal(dto.governmentFeeAmount),
        serviceFeeAmount: new Decimal(dto.serviceFeeAmount),
        expeditedFeeAmount: dto.expeditedFeeAmount ? new Decimal(dto.expeditedFeeAmount) : null,
        currencyCode: dto.currencyCode.toUpperCase(),
        expeditedEnabled: dto.expeditedEnabled ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    this.logger.log(`Binding nationality fee created: ${fee.id} for binding: ${bindingId}`);
    return this.mapToResponse(fee);
  }

  /**
   * Update nationality fee
   */
  async update(
    feeId: string,
    dto: UpdateBindingNationalityFeeDto,
  ): Promise<BindingNationalityFeeResponseDto> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Nationality fee does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate if changing nationality
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
        throw new ConflictException('Nationality fee already exists', [
          {
            field: 'nationalityCountryId',
            reason: ErrorCodes.CONFLICT,
            message: 'A fee already exists for this nationality in this binding',
          },
        ]);
      }

      const nationalityCountry = await this.prisma.country.findFirst({
        where: { id: dto.nationalityCountryId, deletedAt: null },
      });

      if (!nationalityCountry) {
        throw new NotFoundException('Nationality country not found', [
          {
            reason: ErrorCodes.COUNTRY_NOT_FOUND,
            message: 'Nationality country does not exist or has been deleted',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.nationalityCountryId !== undefined)
      updateData.nationalityCountryId = dto.nationalityCountryId;
    if (dto.governmentFeeAmount !== undefined)
      updateData.governmentFeeAmount = new Decimal(dto.governmentFeeAmount);
    if (dto.serviceFeeAmount !== undefined)
      updateData.serviceFeeAmount = new Decimal(dto.serviceFeeAmount);
    if (dto.expeditedFeeAmount !== undefined) {
      updateData.expeditedFeeAmount = dto.expeditedFeeAmount
        ? new Decimal(dto.expeditedFeeAmount)
        : null;
    }
    if (dto.currencyCode !== undefined) updateData.currencyCode = dto.currencyCode.toUpperCase();
    if (dto.expeditedEnabled !== undefined) updateData.expeditedEnabled = dto.expeditedEnabled;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedFee = await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: updateData,
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    this.logger.log(`Binding nationality fee updated: ${feeId}`);
    return this.mapToResponse(updatedFee);
  }

  /**
   * Soft delete nationality fee
   */
  async delete(feeId: string): Promise<void> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Nationality fee does not exist or has been deleted',
        },
      ]);
    }

    await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Binding nationality fee soft deleted: ${feeId}`);
  }

  private mapToResponse(fee: any): BindingNationalityFeeResponseDto {
    return {
      id: fee.id,
      templateBindingId: fee.templateBindingId,
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
    };
  }
}
