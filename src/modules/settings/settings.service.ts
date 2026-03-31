import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsResponseDto, UpdateSettingsDto } from './dto';

const DEFAULT_SETTINGS: SettingsResponseDto = {
  siteName: 'E-Visa Portal',
  supportEmail: 'support@evisa.gov',
  defaultCurrency: 'USD',
  paymentTimeoutHours: 24,
  maintenanceMode: false,
};

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<SettingsResponseDto> {
    const setting = await this.prisma.setting.findFirst();

    if (!setting) {
      return DEFAULT_SETTINGS;
    }

    return {
      siteName: setting.siteName ?? DEFAULT_SETTINGS.siteName,
      supportEmail: setting.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
      defaultCurrency: setting.defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
      paymentTimeoutHours: setting.paymentTimeoutHours ?? DEFAULT_SETTINGS.paymentTimeoutHours,
      maintenanceMode: setting.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
    };
  }

  async update(dto: UpdateSettingsDto): Promise<SettingsResponseDto> {
    const existingSetting = await this.prisma.setting.findFirst();

    const updateData: Record<string, unknown> = {};
    const updatedFields: string[] = [];

    if (dto.siteName !== undefined) {
      updateData.siteName = dto.siteName;
      updatedFields.push('siteName');
    }
    if (dto.supportEmail !== undefined) {
      updateData.supportEmail = dto.supportEmail;
      updatedFields.push('supportEmail');
    }
    if (dto.defaultCurrency !== undefined) {
      updateData.defaultCurrency = dto.defaultCurrency;
      updatedFields.push('defaultCurrency');
    }
    if (dto.paymentTimeoutHours !== undefined) {
      updateData.paymentTimeoutHours = dto.paymentTimeoutHours;
      updatedFields.push('paymentTimeoutHours');
    }
    if (dto.maintenanceMode !== undefined) {
      updateData.maintenanceMode = dto.maintenanceMode;
      updatedFields.push('maintenanceMode');
    }

    if (existingSetting) {
      await this.prisma.setting.update({
        where: { id: existingSetting.id },
        data: updateData,
      });
    } else {
      await this.prisma.setting.create({
        data: {
          siteName: dto.siteName ?? DEFAULT_SETTINGS.siteName,
          supportEmail: dto.supportEmail ?? DEFAULT_SETTINGS.supportEmail,
          defaultCurrency: dto.defaultCurrency ?? DEFAULT_SETTINGS.defaultCurrency,
          paymentTimeoutHours: dto.paymentTimeoutHours ?? DEFAULT_SETTINGS.paymentTimeoutHours,
          maintenanceMode: dto.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
        },
      });
    }

    this.logger.log(`Settings updated: ${updatedFields.join(', ')}`);
    return this.get();
  }
}
