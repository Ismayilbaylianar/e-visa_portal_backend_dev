import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { UpdatePaymentPageConfigDto, PaymentPageConfigResponseDto } from './dto';

/**
 * Module 5 — Payment Page Config (singleton).
 *
 * Schema fields: 11 admin-facing total split into Content / Layout /
 * Behavior groups, plus the forward-compat `sectionsJson` slot for the
 * Sprint 4 advanced section builder UI.
 *
 * Audit: a single `paymentPageConfig.update` entry is emitted on every
 * save with full before/after snapshots — payment page config affects
 * what end users see when paying, full snapshot keeps forensics
 * trivial.
 */
@Injectable()
export class PaymentPageConfigsService {
  private readonly logger = new Logger(PaymentPageConfigsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Read or auto-create the singleton config row.
   */
  async getConfig(): Promise<PaymentPageConfigResponseDto> {
    let config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      this.logger.log('No payment page config found, creating default');
      // Generic defaults — real branding flows through the admin UI,
      // never bake the production brand into business logic here.
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
          // The rest fall back to schema defaults (showCardLogos=true,
          // primaryButtonText='Pay Now', timeoutWarningMinutes=5, etc.).
        },
      });
    }

    return this.mapToResponse(config);
  }

  /**
   * Update the singleton config row in place. Captures full
   * before/after snapshot for the audit log.
   */
  async updateConfig(
    dto: UpdatePaymentPageConfigDto,
    actorUserId?: string,
  ): Promise<PaymentPageConfigResponseDto> {
    let config = await this.prisma.paymentPageConfig.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // First-save case — create the row from the incoming DTO, falling
    // back to safe defaults for fields the admin didn't send.
    if (!config) {
      this.logger.log('No payment page config found, creating with provided values');
      config = await this.prisma.paymentPageConfig.create({
        data: {
          title: dto.title ?? 'Payment Information',
          description: dto.description ?? null,
          supportText: dto.supportText ?? null,
          footerNote: dto.footerNote ?? null,
          showCardLogos: dto.showCardLogos ?? true,
          showSecurityBadges: dto.showSecurityBadges ?? true,
          primaryButtonText: dto.primaryButtonText ?? 'Pay Now',
          timeoutWarningMinutes: dto.timeoutWarningMinutes ?? 5,
          termsCheckboxRequired: dto.termsCheckboxRequired ?? false,
          termsCheckboxText: dto.termsCheckboxText ?? null,
          sectionsJson: (dto.sectionsJson as any) ?? [],
          isActive: dto.isActive ?? true,
        },
      });

      if (actorUserId) {
        await this.auditLogsService.logAdminAction(
          actorUserId,
          'paymentPageConfig.update',
          'PaymentPageConfig',
          config.id,
          undefined,
          this.snapshot(config),
        );
      }

      this.logger.log(`Payment page config created: ${config.id}`);
      return this.mapToResponse(config);
    }

    // Update path — capture before-snapshot, assemble partial update.
    const before = this.snapshot(config);
    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.supportText !== undefined) updateData.supportText = dto.supportText;
    if (dto.footerNote !== undefined) updateData.footerNote = dto.footerNote;
    if (dto.showCardLogos !== undefined) updateData.showCardLogos = dto.showCardLogos;
    if (dto.showSecurityBadges !== undefined)
      updateData.showSecurityBadges = dto.showSecurityBadges;
    if (dto.primaryButtonText !== undefined)
      updateData.primaryButtonText = dto.primaryButtonText;
    if (dto.timeoutWarningMinutes !== undefined)
      updateData.timeoutWarningMinutes = dto.timeoutWarningMinutes;
    if (dto.termsCheckboxRequired !== undefined)
      updateData.termsCheckboxRequired = dto.termsCheckboxRequired;
    if (dto.termsCheckboxText !== undefined)
      updateData.termsCheckboxText = dto.termsCheckboxText;
    if (dto.sectionsJson !== undefined) updateData.sectionsJson = dto.sectionsJson as any;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    config = await this.prisma.paymentPageConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'paymentPageConfig.update',
        'PaymentPageConfig',
        config.id,
        before,
        this.snapshot(config),
      );
    }

    this.logger.log(`Payment page config updated: ${config.id}`);
    return this.mapToResponse(config);
  }

  /**
   * Compact field snapshot used by the audit log. Excludes id /
   * timestamps because they don't belong in the diff payload.
   */
  private snapshot(c: any) {
    return {
      title: c.title,
      description: c.description,
      supportText: c.supportText,
      footerNote: c.footerNote,
      showCardLogos: c.showCardLogos,
      showSecurityBadges: c.showSecurityBadges,
      primaryButtonText: c.primaryButtonText,
      timeoutWarningMinutes: c.timeoutWarningMinutes,
      termsCheckboxRequired: c.termsCheckboxRequired,
      termsCheckboxText: c.termsCheckboxText,
      isActive: c.isActive,
      // sectionsJson skipped from snapshot — Json field can be large
      // and the advanced section builder UI lives in Sprint 4.
    };
  }

  /**
   * Map config entity to response DTO.
   */
  private mapToResponse(config: any): PaymentPageConfigResponseDto {
    return {
      id: config.id,
      title: config.title,
      description: config.description ?? undefined,
      supportText: config.supportText ?? undefined,
      footerNote: config.footerNote ?? undefined,
      showCardLogos: config.showCardLogos,
      showSecurityBadges: config.showSecurityBadges,
      primaryButtonText: config.primaryButtonText,
      timeoutWarningMinutes: config.timeoutWarningMinutes,
      termsCheckboxRequired: config.termsCheckboxRequired,
      termsCheckboxText: config.termsCheckboxText ?? undefined,
      sectionsJson: config.sectionsJson,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }
}
