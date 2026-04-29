import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { UpdateSettingsDto, SettingsResponseDto } from './dto';

/**
 * Module 4 — Settings (singleton).
 *
 * Schema fields: 18 total split into general / payment / email /
 * application / maintenance / branding / legal groups. Email-from
 * address and applicationCodeFormat are admin-editable today but
 * runtime cutover (.env override / generator wiring) ships in Sprint 5.
 *
 * Audit: a single `settings.update` entry is emitted on every save
 * with full before/after snapshots — settings is high-value data
 * (changes affect the entire portal), full snapshot keeps forensics
 * trivial.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Read or auto-create the singleton settings row.
   */
  async getSettings(): Promise<SettingsResponseDto> {
    let settings = await this.prisma.setting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!settings) {
      this.logger.log('No settings found, creating default settings');
      // Generic placeholder defaults — real branding lives in
      // prisma/seed.ts (DB seed for the production environment) and
      // is set per-deployment by the admin UI. Do not bake the real
      // brand into business logic here — keeps fallbacks reusable
      // across environments and rebrands.
      settings = await this.prisma.setting.create({
        data: {
          siteName: 'Visa Portal',
          supportEmail: 'support@example.com',
          // The rest fall back to schema defaults (siteUrl='', etc.).
        },
      });
    }

    return this.mapToResponse(settings);
  }

  /**
   * Update the singleton row in place. Captures full before/after
   * snapshot for the audit log.
   */
  async updateSettings(
    dto: UpdateSettingsDto,
    actorUserId?: string,
  ): Promise<SettingsResponseDto> {
    let settings = await this.prisma.setting.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // First-save case — create the row from the incoming DTO, falling
    // back to safe defaults for fields the admin didn't send.
    if (!settings) {
      this.logger.log('No settings found, creating with provided values');
      settings = await this.prisma.setting.create({
        data: {
          siteName: dto.siteName ?? 'Visa Portal',
          supportEmail: dto.supportEmail ?? 'support@example.com',
          siteUrl: dto.siteUrl ?? '',
          defaultCurrency: dto.defaultCurrency ?? 'USD',
          paymentTimeoutHours: dto.paymentTimeoutHours ?? 3,
          smtpFromAddress: dto.smtpFromAddress ?? '',
          smtpFromName: dto.smtpFromName ?? '',
          notificationEmailEnabled: dto.notificationEmailEnabled ?? true,
          applicationCodeFormat: dto.applicationCodeFormat ?? 'EV-{YYYY}-{NNNN}',
          maxApplicantsPerApplication: dto.maxApplicantsPerApplication ?? 10,
          allowMultipleVisaTypes: dto.allowMultipleVisaTypes ?? false,
          maintenanceMode: dto.maintenanceMode ?? false,
          maintenanceMessage: dto.maintenanceMessage ?? null,
          logoUrl: dto.logoUrl ?? null,
          faviconUrl: dto.faviconUrl ?? null,
          googleAnalyticsId: dto.googleAnalyticsId ?? null,
          termsUrl: dto.termsUrl ?? null,
          privacyUrl: dto.privacyUrl ?? null,
        },
      });

      if (actorUserId) {
        await this.auditLogsService.logAdminAction(
          actorUserId,
          'settings.update',
          'Settings',
          settings.id,
          undefined,
          this.snapshot(settings),
        );
      }

      this.logger.log(`Settings created: ${settings.id}`);
      return this.mapToResponse(settings);
    }

    // Update path — assemble the partial update + capture a snapshot
    // of the current row before mutation for the audit log.
    const before = this.snapshot(settings);
    const updateData: any = {};
    if (dto.siteName !== undefined) updateData.siteName = dto.siteName;
    if (dto.siteUrl !== undefined) updateData.siteUrl = dto.siteUrl;
    if (dto.supportEmail !== undefined) updateData.supportEmail = dto.supportEmail;
    if (dto.defaultCurrency !== undefined) updateData.defaultCurrency = dto.defaultCurrency;
    if (dto.paymentTimeoutHours !== undefined)
      updateData.paymentTimeoutHours = dto.paymentTimeoutHours;
    if (dto.smtpFromAddress !== undefined) updateData.smtpFromAddress = dto.smtpFromAddress;
    if (dto.smtpFromName !== undefined) updateData.smtpFromName = dto.smtpFromName;
    if (dto.notificationEmailEnabled !== undefined)
      updateData.notificationEmailEnabled = dto.notificationEmailEnabled;
    if (dto.applicationCodeFormat !== undefined)
      updateData.applicationCodeFormat = dto.applicationCodeFormat;
    if (dto.maxApplicantsPerApplication !== undefined)
      updateData.maxApplicantsPerApplication = dto.maxApplicantsPerApplication;
    if (dto.allowMultipleVisaTypes !== undefined)
      updateData.allowMultipleVisaTypes = dto.allowMultipleVisaTypes;
    if (dto.maintenanceMode !== undefined) updateData.maintenanceMode = dto.maintenanceMode;
    if (dto.maintenanceMessage !== undefined)
      updateData.maintenanceMessage = dto.maintenanceMessage;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.faviconUrl !== undefined) updateData.faviconUrl = dto.faviconUrl;
    if (dto.googleAnalyticsId !== undefined)
      updateData.googleAnalyticsId = dto.googleAnalyticsId;
    if (dto.termsUrl !== undefined) updateData.termsUrl = dto.termsUrl;
    if (dto.privacyUrl !== undefined) updateData.privacyUrl = dto.privacyUrl;

    settings = await this.prisma.setting.update({
      where: { id: settings.id },
      data: updateData,
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'settings.update',
        'Settings',
        settings.id,
        before,
        this.snapshot(settings),
      );
    }

    this.logger.log(`Settings updated: ${settings.id}`);
    return this.mapToResponse(settings);
  }

  /**
   * Compact field snapshot used by the audit log. Excludes id /
   * timestamps because they don't belong in the diff payload.
   */
  private snapshot(s: any) {
    return {
      siteName: s.siteName,
      siteUrl: s.siteUrl,
      supportEmail: s.supportEmail,
      defaultCurrency: s.defaultCurrency,
      paymentTimeoutHours: s.paymentTimeoutHours,
      smtpFromAddress: s.smtpFromAddress,
      smtpFromName: s.smtpFromName,
      notificationEmailEnabled: s.notificationEmailEnabled,
      applicationCodeFormat: s.applicationCodeFormat,
      maxApplicantsPerApplication: s.maxApplicantsPerApplication,
      allowMultipleVisaTypes: s.allowMultipleVisaTypes,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      logoUrl: s.logoUrl,
      faviconUrl: s.faviconUrl,
      googleAnalyticsId: s.googleAnalyticsId,
      termsUrl: s.termsUrl,
      privacyUrl: s.privacyUrl,
    };
  }

  /**
   * Map settings entity to response DTO.
   */
  private mapToResponse(settings: any): SettingsResponseDto {
    return {
      id: settings.id,
      siteName: settings.siteName,
      siteUrl: settings.siteUrl,
      supportEmail: settings.supportEmail,
      defaultCurrency: settings.defaultCurrency,
      paymentTimeoutHours: settings.paymentTimeoutHours,
      smtpFromAddress: settings.smtpFromAddress,
      smtpFromName: settings.smtpFromName,
      notificationEmailEnabled: settings.notificationEmailEnabled,
      applicationCodeFormat: settings.applicationCodeFormat,
      maxApplicantsPerApplication: settings.maxApplicantsPerApplication,
      allowMultipleVisaTypes: settings.allowMultipleVisaTypes,
      maintenanceMode: settings.maintenanceMode,
      maintenanceMessage: settings.maintenanceMessage ?? undefined,
      logoUrl: settings.logoUrl ?? undefined,
      faviconUrl: settings.faviconUrl ?? undefined,
      googleAnalyticsId: settings.googleAnalyticsId ?? undefined,
      termsUrl: settings.termsUrl ?? undefined,
      privacyUrl: settings.privacyUrl ?? undefined,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }
}
