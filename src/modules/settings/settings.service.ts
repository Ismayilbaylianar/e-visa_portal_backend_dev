import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto, SettingsResponseDto } from './dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current settings (singleton)
   * Creates default settings if none exist
   */
  async getSettings(): Promise<SettingsResponseDto> {
    let settings = await this.prisma.setting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // Create default settings if none exist
    if (!settings) {
      this.logger.log('No settings found, creating default settings');
      settings = await this.prisma.setting.create({
        data: {
          siteName: 'E-Visa Portal',
          supportEmail: 'support@example.com',
          defaultCurrency: 'USD',
          paymentTimeoutHours: 3,
          maintenanceMode: false,
        },
      });
    }

    return this.mapToResponse(settings);
  }

  /**
   * Update settings (singleton)
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    // Get existing settings or create default
    let settings = await this.prisma.setting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      this.logger.log('No settings found, creating with provided values');
      settings = await this.prisma.setting.create({
        data: {
          siteName: dto.siteName ?? 'E-Visa Portal',
          supportEmail: dto.supportEmail ?? 'support@example.com',
          defaultCurrency: dto.defaultCurrency ?? 'USD',
          paymentTimeoutHours: dto.paymentTimeoutHours ?? 3,
          maintenanceMode: dto.maintenanceMode ?? false,
        },
      });
    } else {
      // Update existing settings
      const updateData: any = {};
      if (dto.siteName !== undefined) updateData.siteName = dto.siteName;
      if (dto.supportEmail !== undefined) updateData.supportEmail = dto.supportEmail;
      if (dto.defaultCurrency !== undefined) updateData.defaultCurrency = dto.defaultCurrency;
      if (dto.paymentTimeoutHours !== undefined) updateData.paymentTimeoutHours = dto.paymentTimeoutHours;
      if (dto.maintenanceMode !== undefined) updateData.maintenanceMode = dto.maintenanceMode;

      settings = await this.prisma.setting.update({
        where: { id: settings.id },
        data: updateData,
      });

      this.logger.log(`Settings updated: ${settings.id}`);
    }

    return this.mapToResponse(settings);
  }

  /**
   * Map settings entity to response DTO
   */
  private mapToResponse(settings: any): SettingsResponseDto {
    return {
      id: settings.id,
      siteName: settings.siteName,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      paymentTimeoutHours: settings.paymentTimeoutHours,
      maintenanceMode: settings.maintenanceMode,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
