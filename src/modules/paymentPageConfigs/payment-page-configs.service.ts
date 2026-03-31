import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentPageConfigResponseDto, UpdatePaymentPageConfigDto } from './dto';
import { NotFoundException } from '@/common/exceptions';

@Injectable()
export class PaymentPageConfigsService {
  private readonly logger = new Logger(PaymentPageConfigsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PaymentPageConfigResponseDto> {
    const config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      throw new NotFoundException('Payment page config not found');
    }

    return this.mapToResponse(config);
  }

  async update(dto: UpdatePaymentPageConfigDto): Promise<PaymentPageConfigResponseDto> {
    let config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await this.prisma.paymentPageConfig.create({
        data: {
          title: dto.title ?? 'Payment',
          description: dto.description,
          sectionsJson: dto.sectionsJson ?? [],
          isActive: dto.isActive ?? true,
        },
      });
      this.logger.log(`Payment page config created: ${config.id}`);
    } else {
      config = await this.prisma.paymentPageConfig.update({
        where: { id: config.id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.sectionsJson !== undefined && { sectionsJson: dto.sectionsJson }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });
      this.logger.log(`Payment page config updated: ${config.id}`);
    }

    return this.mapToResponse(config);
  }

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
