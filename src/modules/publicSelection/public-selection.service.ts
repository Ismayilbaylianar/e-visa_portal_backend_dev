import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SelectionOptionsResponseDto,
  SelectionPreviewRequestDto,
  SelectionPreviewResponseDto,
} from './dto';

@Injectable()
export class PublicSelectionService {
  private readonly logger = new Logger(PublicSelectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOptions(): Promise<SelectionOptionsResponseDto> {
    const [countries, visaTypes] = await Promise.all([
      this.prisma.country.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.visaType.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },
        orderBy: { label: 'asc' },
      }),
    ]);

    return {
      countries: countries.map(country => ({
        id: country.id,
        name: country.name,
        slug: country.slug,
        isoCode: country.isoCode,
      })),
      visaTypes: visaTypes.map(visaType => ({
        id: visaType.id,
        purpose: visaType.purpose,
        validityDays: visaType.validityDays,
        maxStay: visaType.maxStay,
        entries: visaType.entries,
        label: visaType.label,
      })),
    };
  }

  async getPreview(
    dto: SelectionPreviewRequestDto,
  ): Promise<SelectionPreviewResponseDto> {
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
        isActive: true,
        deletedAt: null,
      },
      include: {
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
      return {
        available: false,
        message:
          'This destination and visa type combination is not currently available',
      };
    }

    const nationalityFee = templateBinding.nationalityFees[0];
    if (!nationalityFee) {
      return {
        available: false,
        message: 'This visa type is not available for your nationality',
      };
    }

    const governmentFee = Number(nationalityFee.governmentFeeAmount);
    const serviceFee = Number(nationalityFee.serviceFeeAmount);
    const expeditedFee =
      dto.expedited && nationalityFee.expeditedEnabled
        ? Number(nationalityFee.expeditedFeeAmount || 0)
        : 0;

    const totalFee = governmentFee + serviceFee + expeditedFee;

    this.logger.log(
      `Preview generated for nationality: ${dto.nationalityCountryId}, destination: ${dto.destinationCountryId}, visa: ${dto.visaTypeId}`,
    );

    return {
      available: true,
      feeBreakdown: {
        governmentFee: governmentFee.toFixed(2),
        serviceFee: serviceFee.toFixed(2),
        expeditedFee:
          dto.expedited && nationalityFee.expeditedEnabled
            ? expeditedFee.toFixed(2)
            : undefined,
        totalFee: totalFee.toFixed(2),
        currencyCode: nationalityFee.currencyCode,
      },
      expeditedAvailable: nationalityFee.expeditedEnabled,
      processingDays: 7,
      expeditedProcessingDays: 3,
    };
  }
}
