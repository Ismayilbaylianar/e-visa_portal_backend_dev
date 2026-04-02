import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePaymentPageConfigDto, PaymentPageConfigResponseDto } from './dto';

@Injectable()
export class PaymentPageConfigsService {
  private readonly logger = new Logger(PaymentPageConfigsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current payment page config (singleton)
   * Creates default config if none exists
   */
  async getConfig(): Promise<PaymentPageConfigResponseDto> {
    let config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Create default config if none exists
    if (!config) {
      this.logger.log('No payment page config found, creating default');
      config = await this.prisma.paymentPageConfig.create({
        data: {
          title: 'Payment Information',
          description: 'Please review your payment details before proceeding.',
          sectionsJson: [
            {
              key: 'summary',
              title: 'Payment Summary',
              fields: [],
            },
          ],
          isActive: true,
        },
      });
    }

    return this.mapToResponse(config);
  }

  /**
   * Update payment page config (singleton)
   */
  async updateConfig(dto: UpdatePaymentPageConfigDto): Promise<PaymentPageConfigResponseDto> {
    // Get existing config or create default
    let config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      this.logger.log('No payment page config found, creating with provided values');
      config = await this.prisma.paymentPageConfig.create({
        data: {
          title: dto.title ?? 'Payment Information',
          description: dto.description ?? null,
          sectionsJson: (dto.sectionsJson as any) ?? [],
          isActive: dto.isActive ?? true,
        },
      });
    } else {
      // Update existing config
      const updateData: any = {};
      if (dto.title !== undefined) updateData.title = dto.title;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.sectionsJson !== undefined) updateData.sectionsJson = dto.sectionsJson as any;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

      config = await this.prisma.paymentPageConfig.update({
        where: { id: config.id },
        data: updateData,
      });

      this.logger.log(`Payment page config updated: ${config.id}`);
    }

    return this.mapToResponse(config);
  }

  /**
   * Map config entity to response DTO
   */
  private mapToResponse(config: any): PaymentPageConfigResponseDto {
    return {
      id: config.id,
      title: config.title,
      description: config.description || undefined,
      sectionsJson: config.sectionsJson,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
