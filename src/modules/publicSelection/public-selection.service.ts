import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
} from './dto';

@Injectable()
export class PublicSelectionService {
  private readonly logger = new Logger(PublicSelectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get selection options for public UI
   *
   * Note: Nationality countries currently use the same countries table as destination countries.
   * This is an assumption - in production, you may want a separate nationality source or
   * filter countries that have at least one nationality fee configured.
   */
  async getOptions(): Promise<SelectionOptionsResponseDto> {
    const [destinationCountries, nationalityCountries, visaTypes] = await Promise.all([
      // Destination countries: have a published, active CountryPage. The page
      // join also gives us the URL slug (countries themselves no longer carry
      // a slug after the Module 1.5 split).
      this.prisma.country.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          page: {
            is: {
              isActive: true,
              isPublished: true,
              deletedAt: null,
            },
          },
        },
        include: {
          page: {
            select: { slug: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      // Nationality countries: any active reference country. Sprint 4 / UX-001
      // will refine this to "countries that appear as a nationality in at
      // least one active BindingNationalityFee".
      this.prisma.country.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      }),
      // Visa types: active only
      this.prisma.visaType.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
    ]);

    return {
      destinationCountries: destinationCountries.map((country: any) => ({
        id: country.id,
        name: country.name,
        slug: country.page?.slug,
        isoCode: country.isoCode,
        flagEmoji: country.flagEmoji,
      })),
      nationalityCountries: nationalityCountries.map((country) => ({
        id: country.id,
        name: country.name,
        // Nationality entries don't need a slug — left undefined.
        isoCode: country.isoCode,
        flagEmoji: country.flagEmoji,
      })),
      visaTypes: visaTypes.map((visaType) => ({
        id: visaType.id,
        purpose: visaType.purpose,
        validityDays: visaType.validityDays,
        maxStay: visaType.maxStay,
        entries: visaType.entries,
        label: visaType.label,
      })),
    };
  }

  /**
   * Get fee preview for a specific nationality + destination + visa type combination
   *
   * Matching logic:
   * 1. Find binding that matches destinationCountryId + visaTypeId
   * 2. Binding must be: active, not soft-deleted, valid by date range
   * 3. Find nationality fee that matches nationalityCountryId
   * 4. Fee must be: active, not soft-deleted
   *
   * Date validity:
   * - If validFrom is set, current date must be >= validFrom
   * - If validTo is set, current date must be <= validTo
   * - If both are null, binding is always valid
   */
  async getPreview(dto: SelectionPreviewRequestDto): Promise<SelectionPreviewResponseDto> {
    const now = new Date();

    // Find active binding with date validity check
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        isActive: true,
        deletedAt: null,
        // Date validity: validFrom <= now (or null)
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      },
      include: {
        template: {
          select: { id: true },
        },
        nationalityFees: {
          where: {
            nationalityCountryId: dto.nationalityCountryId,
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    // Check if binding exists
    if (!templateBinding) {
      throw new NotFoundException('No supported binding found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This destination and visa type combination is not currently available',
        },
      ]);
    }

    // Check date validity: validTo >= now (or null)
    if (templateBinding.validTo && templateBinding.validTo < now) {
      throw new NotFoundException('Binding has expired', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This destination and visa type combination is no longer available',
        },
      ]);
    }

    // Check if nationality fee exists
    const nationalityFee = templateBinding.nationalityFees[0];
    if (!nationalityFee) {
      throw new NotFoundException('No fee configured for nationality', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'This visa type is not available for your nationality',
        },
      ]);
    }

    // Calculate fees
    const governmentFeeAmount = Number(nationalityFee.governmentFeeAmount);
    const serviceFeeAmount = Number(nationalityFee.serviceFeeAmount);
    const expeditedFeeAmount = nationalityFee.expeditedFeeAmount
      ? Number(nationalityFee.expeditedFeeAmount)
      : null;
    const totalAmount = governmentFeeAmount + serviceFeeAmount;

    this.logger.log(
      `Preview generated for nationality: ${dto.nationalityCountryId}, destination: ${dto.destinationCountryId}, visa: ${dto.visaTypeId}`,
    );

    return {
      isEligible: true,
      bindingId: templateBinding.id,
      templateId: templateBinding.templateId,
      fees: {
        governmentFeeAmount: governmentFeeAmount.toFixed(2),
        serviceFeeAmount: serviceFeeAmount.toFixed(2),
        expeditedFeeAmount: expeditedFeeAmount !== null ? expeditedFeeAmount.toFixed(2) : null,
        currencyCode: nationalityFee.currencyCode,
        totalAmount: totalAmount.toFixed(2),
        expeditedEnabled: nationalityFee.expeditedEnabled,
      },
    };
  }
}
