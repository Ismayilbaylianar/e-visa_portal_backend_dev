import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { BadRequestException, NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  CountryPageImageListResponseDto,
  CountryPageImageResponseDto,
  ReorderCountryPageImagesDto,
  UpdateCountryPageImageDto,
} from './dto';
import type { MulterFile } from '../documents/dto';

/**
 * Module 11.1 — hero-slider images for public country pages.
 *
 * Storage paths follow `country-pages/{slug}/hero/{generated}.{ext}`.
 * MIME + size validation only (no sharp dimension checks — keeps the
 * dependency footprint small).
 */
@Injectable()
export class CountryPageImagesService {
  private readonly logger = new Logger(CountryPageImagesService.name);

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

  /** Resolve a slug to a CountryPage row (or throw 404). */
  private async getPageBySlug(slug: string) {
    const page = await this.prisma.countryPage.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, slug: true },
    });
    if (!page) {
      throw new NotFoundException('Country page not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No country page with slug "${slug}"` },
      ]);
    }
    return page;
  }

  private validateFile(file: MulterFile): void {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file provided', [
        { reason: ErrorCodes.BAD_REQUEST, message: 'File is required' },
      ]);
    }
    if (file.size > CountryPageImagesService.MAX_BYTES) {
      throw new BadRequestException('File too large', [
        {
          reason: ErrorCodes.FILE_TOO_LARGE,
          message: `File "${file.originalname}" exceeds ${CountryPageImagesService.MAX_BYTES / 1024 / 1024}MB`,
        },
      ]);
    }
    if (!CountryPageImagesService.ALLOWED_MIME.includes(file.mimetype as never)) {
      throw new BadRequestException('Invalid file type', [
        {
          reason: ErrorCodes.FILE_TYPE_NOT_ALLOWED,
          message: `Allowed: ${CountryPageImagesService.ALLOWED_MIME.join(', ')}`,
        },
      ]);
    }
  }

  // =========================================================
  // Admin
  // =========================================================

  async list(slug: string): Promise<CountryPageImageListResponseDto> {
    const page = await this.getPageBySlug(slug);
    const items = await this.prisma.countryPageImage.findMany({
      where: { countryPageId: page.id, deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });
    return {
      items: items.map((i) => this.toResponse(i)),
      total: items.length,
    };
  }

  async create(
    slug: string,
    file: MulterFile,
    altText: string | undefined,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<CountryPageImageResponseDto> {
    this.validateFile(file);
    const page = await this.getPageBySlug(slug);

    // Default sort key — append to the end so existing order stays.
    const max = await this.prisma.countryPageImage.aggregate({
      where: { countryPageId: page.id, deletedAt: null },
      _max: { displayOrder: true },
    });
    const displayOrder = (max._max.displayOrder ?? -1) + 1;

    const prefix = `country-pages/${slug}/hero`;
    const upload = await this.storageService.upload(file.buffer, {
      contentType: file.mimetype,
      prefix,
      originalFilename: file.originalname,
      metadata: {
        countryPageId: page.id,
        slug,
      },
    });

    const created = await this.prisma.countryPageImage.create({
      data: {
        countryPageId: page.id,
        imageUrl: upload.storageKey,
        altText: altText?.trim() || null,
        displayOrder,
        isPublished: true,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'countryPageImage.create',
      entityType: 'CountryPageImage',
      entityId: created.id,
      newValue: {
        slug,
        imageUrl: created.imageUrl,
        originalFilename: file.originalname,
        fileSize: upload.size,
        altText: created.altText,
        displayOrder: created.displayOrder,
      },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`CountryPageImage created: ${created.id} on slug=${slug}`);
    return this.toResponse(created);
  }

  async update(
    slug: string,
    id: string,
    dto: UpdateCountryPageImageDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<CountryPageImageResponseDto> {
    const page = await this.getPageBySlug(slug);
    const existing = await this.prisma.countryPageImage.findFirst({
      where: { id, countryPageId: page.id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Image not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Image does not belong to this country page' },
      ]);
    }

    const before = { altText: existing.altText, isPublished: existing.isPublished };
    const updated = await this.prisma.countryPageImage.update({
      where: { id },
      data: {
        altText: dto.altText !== undefined ? dto.altText.trim() || null : undefined,
        isPublished: dto.isPublished ?? undefined,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'countryPageImage.update',
      entityType: 'CountryPageImage',
      entityId: id,
      oldValue: before,
      newValue: { altText: updated.altText, isPublished: updated.isPublished },
      ipAddress: ip,
      userAgent,
    });

    return this.toResponse(updated);
  }

  async delete(
    slug: string,
    id: string,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const page = await this.getPageBySlug(slug);
    const existing = await this.prisma.countryPageImage.findFirst({
      where: { id, countryPageId: page.id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Image not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Image does not belong to this country page' },
      ]);
    }

    await this.prisma.countryPageImage.update({
      where: { id },
      data: { deletedAt: new Date(), updatedByUserId: adminUserId },
    });

    // Best-effort storage cleanup. If storage delete fails the row is
    // already soft-deleted on the DB side and won't be served.
    this.storageService.delete(existing.imageUrl).catch((err) => {
      this.logger.warn(
        `Failed to delete storage object ${existing.imageUrl}: ${String(err)}`,
      );
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'countryPageImage.delete',
      entityType: 'CountryPageImage',
      entityId: id,
      oldValue: { slug, imageUrl: existing.imageUrl, altText: existing.altText },
      ipAddress: ip,
      userAgent,
    });
  }

  async reorder(
    slug: string,
    dto: ReorderCountryPageImagesDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<CountryPageImageListResponseDto> {
    const page = await this.getPageBySlug(slug);
    const ids = dto.items.map((i) => i.id);
    const owned = await this.prisma.countryPageImage.findMany({
      where: { id: { in: ids }, countryPageId: page.id, deletedAt: null },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      throw new BadRequestException('One or more images do not belong to this page', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'reorder body contains image ids that do not belong to this slug',
        },
      ]);
    }

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.countryPageImage.update({
          where: { id: i.id },
          data: { displayOrder: i.displayOrder, updatedByUserId: adminUserId },
        }),
      ),
    );

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'countryPageImage.reorder',
      entityType: 'CountryPageImage',
      entityId: dto.items[0]?.id ?? page.id,
      newValue: { slug, reorderedItems: dto.items },
      ipAddress: ip,
      userAgent,
    });

    return this.list(slug);
  }

  // =========================================================
  // Public (no auth)
  // =========================================================

  async listPublishedBySlug(slug: string): Promise<CountryPageImageListResponseDto> {
    const page = await this.prisma.countryPage.findFirst({
      where: { slug, deletedAt: null, isActive: true, isPublished: true },
      select: { id: true },
    });
    if (!page) {
      // Treat missing/unpublished page same as no images — return empty.
      return { items: [], total: 0 };
    }
    const items = await this.prisma.countryPageImage.findMany({
      where: { countryPageId: page.id, deletedAt: null, isPublished: true },
      orderBy: { displayOrder: 'asc' },
    });
    return {
      items: items.map((i) => this.toResponse(i)),
      total: items.length,
    };
  }

  // =========================================================
  // Mappers
  // =========================================================

  private toResponse(row: {
    id: string;
    countryPageId: string;
    imageUrl: string;
    altText: string | null;
    displayOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): CountryPageImageResponseDto {
    return {
      id: row.id,
      countryPageId: row.countryPageId,
      imageUrl: this.toPublicUrl(row.imageUrl),
      altText: row.altText ?? undefined,
      displayOrder: row.displayOrder,
      isPublished: row.isPublished,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Convert a storage key into a URL the browser can fetch directly.
   *
   * Local-storage provider stores files under a `STORAGE_LOCAL_PATH`
   * served at `/storage/...`. For S3-style providers, the storage key
   * IS the relative URL under `getBaseUrl()`. Either way, the simple
   * convention is `${baseUrl}/${storageKey}` — both providers obey it.
   */
  private toPublicUrl(storageKey: string): string {
    // If it's already an absolute URL (S3 with baseUrl prefix), keep it.
    if (/^https?:\/\//i.test(storageKey)) return storageKey;
    const base = this.storageService.getBaseUrl().replace(/\/$/, '');
    const key = storageKey.replace(/^\/+/, '');
    return `${base}/${key}`;
  }
}
