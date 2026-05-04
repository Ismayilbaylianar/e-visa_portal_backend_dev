import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { BadRequestException, NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  CreateHomepageSlideBodyDto,
  HomepageSlideListResponseDto,
  HomepageSlideResponseDto,
  ReorderHomepageSlidesDto,
  UpdateHomepageSlideDto,
} from './dto';
import type { MulterFile } from '../documents/dto';

/**
 * Module 11.1 — homepage promotional carousel cards.
 *
 * Each slide is admin-managed; image upload is OPTIONAL — the public
 * frontend renders a flag-emoji fallback when `imageUrl` is null,
 * which keeps the demo path looking polished even before any images
 * have been uploaded.
 */
@Injectable()
export class HomepageSlidesService {
  private readonly logger = new Logger(HomepageSlidesService.name);

  private static readonly ALLOWED_MIME = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ] as const;
  private static readonly MAX_BYTES = 5 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // =========================================================
  // Helpers
  // =========================================================

  private validateFile(file: MulterFile): void {
    if (!file || !file.buffer) return; // file is optional on create
    if (file.size > HomepageSlidesService.MAX_BYTES) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.FILE_TOO_LARGE,
          message: `File "${file.originalname}" exceeds ${HomepageSlidesService.MAX_BYTES / 1024 / 1024}MB`,
        },
      ]);
    }
    if (!HomepageSlidesService.ALLOWED_MIME.includes(file.mimetype as never)) {
      throw new BadRequestException('Invalid file type', [
        {
          reason: ErrorCodes.FILE_TYPE_NOT_ALLOWED,
          message: `Allowed: ${HomepageSlidesService.ALLOWED_MIME.join(', ')}`,
        },
      ]);
    }
  }

  /** Multipart `isPublished` arrives as the string "true"/"false". */
  private parseBool(v: unknown, fallback: boolean): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      if (v === 'true' || v === '1') return true;
      if (v === 'false' || v === '0' || v === '') return false;
    }
    return fallback;
  }

  // =========================================================
  // Admin
  // =========================================================

  async list(): Promise<HomepageSlideListResponseDto> {
    const items = await this.prisma.homepageSlide.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: 'asc' },
      include: {
        country: {
          select: {
            id: true,
            isoCode: true,
            name: true,
            flagEmoji: true,
            page: { select: { slug: true } },
          },
        },
      },
    });
    return {
      items: items.map((i) => this.toResponse(i)),
      total: items.length,
    };
  }

  async create(
    dto: CreateHomepageSlideBodyDto,
    file: MulterFile | undefined,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HomepageSlideResponseDto> {
    if (file) this.validateFile(file);

    // Verify the country FK if provided so a bad id throws a clean 400
    // instead of a Prisma constraint error at create time.
    if (dto.countryId) {
      const country = await this.prisma.country.findFirst({
        where: { id: dto.countryId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!country) {
        throw new BadRequestException('Country not found', [
          { reason: ErrorCodes.NOT_FOUND, message: `No active country with id "${dto.countryId}"` },
        ]);
      }
    }

    // Append to the end of the carousel.
    const max = await this.prisma.homepageSlide.aggregate({
      where: { deletedAt: null },
      _max: { displayOrder: true },
    });
    const displayOrder = (max._max.displayOrder ?? -1) + 1;

    let imageUrl: string | null = null;
    if (file) {
      const slug =
        // Use the country slug as the storage prefix when present, fall
        // back to a UUID-shaped path so two slugless slides don't collide.
        (await this.resolveCountrySlug(dto.countryId)) ?? `untitled-${Date.now()}`;
      const upload = await this.storageService.upload(file.buffer, {
        contentType: file.mimetype,
        prefix: `homepage-slides/${slug}`,
        originalFilename: file.originalname,
        metadata: { countryId: dto.countryId ?? '' },
      });
      imageUrl = upload.storageKey;
    }

    const created = await this.prisma.homepageSlide.create({
      data: {
        countryId: dto.countryId ?? null,
        imageUrl,
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        ctaText: dto.ctaText?.trim() || 'Apply Now',
        ctaUrl: dto.ctaUrl?.trim() || null,
        displayOrder,
        isPublished: this.parseBool(dto.isPublished, true),
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
      include: this.includeShape(),
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'homepageSlide.create',
      entityType: 'HomepageSlide',
      entityId: created.id,
      newValue: {
        title: created.title,
        countryId: created.countryId,
        imageUrl: created.imageUrl,
        isPublished: created.isPublished,
      },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`HomepageSlide created: ${created.id} (${created.title})`);
    return this.toResponse(created);
  }

  async update(
    id: string,
    dto: UpdateHomepageSlideDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HomepageSlideResponseDto> {
    const existing = await this.prisma.homepageSlide.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Homepage slide not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No slide with id "${id}"` },
      ]);
    }

    if (dto.countryId) {
      const country = await this.prisma.country.findFirst({
        where: { id: dto.countryId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!country) {
        throw new BadRequestException('Country not found', [
          { reason: ErrorCodes.NOT_FOUND, message: `No active country with id "${dto.countryId}"` },
        ]);
      }
    }

    const before = {
      title: existing.title,
      subtitle: existing.subtitle,
      ctaText: existing.ctaText,
      ctaUrl: existing.ctaUrl,
      countryId: existing.countryId,
      isPublished: existing.isPublished,
    };

    // Audit-friendly distinction: was this an isPublished flip?
    const willBecomePublished =
      dto.isPublished === true && existing.isPublished === false;
    const willBecomeUnpublished =
      dto.isPublished === false && existing.isPublished === true;

    const updated = await this.prisma.homepageSlide.update({
      where: { id },
      data: {
        title: dto.title ?? undefined,
        subtitle: dto.subtitle ?? undefined,
        ctaText: dto.ctaText ?? undefined,
        ctaUrl: dto.ctaUrl ?? undefined,
        countryId: dto.countryId ?? undefined,
        isPublished: dto.isPublished ?? undefined,
        updatedByUserId: adminUserId,
      },
      include: this.includeShape(),
    });

    const actionKey = willBecomePublished
      ? 'homepageSlide.publish'
      : willBecomeUnpublished
        ? 'homepageSlide.unpublish'
        : 'homepageSlide.update';

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey,
      entityType: 'HomepageSlide',
      entityId: updated.id,
      oldValue: before,
      newValue: {
        title: updated.title,
        subtitle: updated.subtitle,
        ctaText: updated.ctaText,
        ctaUrl: updated.ctaUrl,
        countryId: updated.countryId,
        isPublished: updated.isPublished,
      },
      ipAddress: ip,
      userAgent,
    });

    return this.toResponse(updated);
  }

  async delete(
    id: string,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.prisma.homepageSlide.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Homepage slide not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No slide with id "${id}"` },
      ]);
    }
    await this.prisma.homepageSlide.update({
      where: { id },
      data: { deletedAt: new Date(), updatedByUserId: adminUserId },
    });

    if (existing.imageUrl) {
      this.storageService.delete(existing.imageUrl).catch((err) => {
        this.logger.warn(
          `Failed to delete storage object ${existing.imageUrl}: ${String(err)}`,
        );
      });
    }

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'homepageSlide.delete',
      entityType: 'HomepageSlide',
      entityId: id,
      oldValue: { title: existing.title, imageUrl: existing.imageUrl },
      ipAddress: ip,
      userAgent,
    });
  }

  async reorder(
    dto: ReorderHomepageSlidesDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HomepageSlideListResponseDto> {
    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.homepageSlide.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      throw new NotFoundException('Some slides not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'reorder body contains unknown ids' },
      ]);
    }
    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.homepageSlide.update({
          where: { id: i.id },
          data: { displayOrder: i.displayOrder, updatedByUserId: adminUserId },
        }),
      ),
    );
    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'homepageSlide.reorder',
      entityType: 'HomepageSlide',
      entityId: dto.items[0]?.id,
      newValue: { reorderedItems: dto.items },
      ipAddress: ip,
      userAgent,
    });
    return this.list();
  }

  // =========================================================
  // Public (no auth)
  // =========================================================

  async listPublished(): Promise<HomepageSlideListResponseDto> {
    const items = await this.prisma.homepageSlide.findMany({
      where: { deletedAt: null, isPublished: true },
      orderBy: { displayOrder: 'asc' },
      include: this.includeShape(),
    });
    return {
      items: items.map((i) => this.toResponse(i)),
      total: items.length,
    };
  }

  // =========================================================
  // Mappers
  // =========================================================

  private includeShape() {
    return {
      country: {
        select: {
          id: true,
          isoCode: true,
          name: true,
          flagEmoji: true,
          page: { select: { slug: true } },
        },
      },
    } as const;
  }

  private async resolveCountrySlug(
    countryId: string | null | undefined,
  ): Promise<string | null> {
    if (!countryId) return null;
    const c = await this.prisma.country.findUnique({
      where: { id: countryId },
      select: { page: { select: { slug: true } } },
    });
    return c?.page?.slug ?? null;
  }

  private toResponse(row: {
    id: string;
    countryId: string | null;
    imageUrl: string | null;
    title: string;
    subtitle: string | null;
    ctaText: string;
    ctaUrl: string | null;
    displayOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
    country?: {
      id: string;
      isoCode: string;
      name: string;
      flagEmoji: string;
      page: { slug: string } | null;
    } | null;
  }): HomepageSlideResponseDto {
    const slug = row.country?.page?.slug;
    const ctaUrl =
      row.ctaUrl?.trim() ||
      (slug ? `/country/${slug}` : '/');
    return {
      id: row.id,
      imageUrl: row.imageUrl ? this.toPublicUrl(row.imageUrl) : undefined,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      ctaText: row.ctaText,
      ctaUrl,
      country: row.country
        ? {
            id: row.country.id,
            isoCode: row.country.isoCode,
            name: row.country.name,
            flagEmoji: row.country.flagEmoji,
            slug: row.country.page?.slug,
          }
        : undefined,
      displayOrder: row.displayOrder,
      isPublished: row.isPublished,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toPublicUrl(storageKey: string): string {
    if (/^https?:\/\//i.test(storageKey)) return storageKey;
    const base = this.storageService.getBaseUrl().replace(/\/$/, '');
    return `${base}/${storageKey.replace(/^\/+/, '')}`;
  }
}
