import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { ContactInfoResponseDto, UpdateContactInfoDto } from './dto';

/**
 * Module 11.B — contact-info singleton.
 *
 * Exactly one row per environment. The service auto-creates a row
 * on first read with sane defaults so the public footer never
 * 404s before an admin has touched the page.
 */
@Injectable()
export class ContactInfoService {
  private readonly logger = new Logger(ContactInfoService.name);

  // Defaults used only if the table is empty on first read. Production
  // seed.ts seeds these too; this exists as a safety net for fresh
  // dev environments and brand-new deploys.
  private static readonly DEFAULT = {
    email: 'support@evisaglobal.com',
    phone: '+994 50 000 00 00',
    businessHours: 'Monday – Friday: 9:00 AM – 6:00 PM (UTC+4)',
    supportHours: '24/7 Email Support',
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async get(): Promise<ContactInfoResponseDto> {
    let row = await this.prisma.contactInfo.findFirst();
    if (!row) {
      this.logger.log('ContactInfo singleton missing — seeding defaults');
      row = await this.prisma.contactInfo.create({
        data: { ...ContactInfoService.DEFAULT },
      });
    }
    return this.toResponse(row);
  }

  async update(
    dto: UpdateContactInfoDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<ContactInfoResponseDto> {
    // Make sure a row exists so we can update by id (avoids race on
    // first-ever update). `get` auto-creates if needed.
    const current = await this.get();

    const before = {
      email: current.email,
      phone: current.phone,
      whatsapp: current.whatsapp,
      address: current.address,
      city: current.city,
      country: current.country,
      businessHours: current.businessHours,
      supportHours: current.supportHours,
      socialLinks: current.socialLinks,
    };

    const updated = await this.prisma.contactInfo.update({
      where: { id: current.id },
      data: {
        email: dto.email ?? undefined,
        phone: dto.phone ?? undefined,
        whatsapp: dto.whatsapp ?? undefined,
        address: dto.address ?? undefined,
        city: dto.city ?? undefined,
        country: dto.country ?? undefined,
        businessHours: dto.businessHours ?? undefined,
        supportHours: dto.supportHours ?? undefined,
        socialLinksJson: dto.socialLinks ?? undefined,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'contactInfo.update',
      entityType: 'ContactInfo',
      entityId: updated.id,
      oldValue: before,
      newValue: { ...this.toResponse(updated), id: undefined, updatedAt: undefined },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`ContactInfo updated by ${adminUserId}`);
    return this.toResponse(updated);
  }

  // =========================================================
  // Helpers
  // =========================================================

  private toResponse(row: {
    id: string;
    email: string;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    businessHours: string | null;
    supportHours: string | null;
    socialLinksJson: unknown;
    updatedAt: Date;
    updatedByUserId: string | null;
  }): ContactInfoResponseDto {
    const social =
      row.socialLinksJson && typeof row.socialLinksJson === 'object'
        ? (row.socialLinksJson as Record<string, string>)
        : undefined;
    return {
      id: row.id,
      email: row.email,
      phone: row.phone ?? undefined,
      whatsapp: row.whatsapp ?? undefined,
      address: row.address ?? undefined,
      city: row.city ?? undefined,
      country: row.country ?? undefined,
      businessHours: row.businessHours ?? undefined,
      supportHours: row.supportHours ?? undefined,
      socialLinks: social,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId ?? undefined,
    };
  }
}
