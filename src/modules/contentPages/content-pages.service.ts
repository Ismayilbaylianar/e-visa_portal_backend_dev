import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { ConflictException, NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  ContentPageListResponseDto,
  ContentPageResponseDto,
  CreateContentPageDto,
  UpdateContentPageDto,
} from './dto';

/**
 * Module 11.B — admin-managed marketing copy.
 *
 * Soft-delete on the table itself (`deletedAt`) so we never lose
 * the audit trail of what a page used to say. Admin list omits
 * deleted rows by default; public reads also gate on `isPublished`.
 */
@Injectable()
export class ContentPagesService {
  private readonly logger = new Logger(ContentPagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // =========================================================
  // Admin
  // =========================================================

  async list(): Promise<ContentPageListResponseDto> {
    const items = await this.prisma.contentPage.findMany({
      where: { deletedAt: null },
      orderBy: { slug: 'asc' },
    });
    return {
      items: items.map((p) => this.toResponse(p)),
      total: items.length,
    };
  }

  async getBySlug(slug: string): Promise<ContentPageResponseDto> {
    const page = await this.prisma.contentPage.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!page) {
      throw new NotFoundException('Content page not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No content page with slug "${slug}"` },
      ]);
    }
    return this.toResponse(page);
  }

  async create(
    dto: CreateContentPageDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<ContentPageResponseDto> {
    // Slug uniqueness is also enforced by the DB unique index, but
    // checking up front gives a friendly 409 instead of a Prisma
    // constraint error.
    const existing = await this.prisma.contentPage.findUnique({ where: { slug: dto.slug } });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Slug already in use', [
        { reason: ErrorCodes.CONFLICT, message: `Slug "${dto.slug}" already exists` },
      ]);
    }

    const page = await this.prisma.contentPage.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        contentHtml: dto.contentHtml,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        isPublished: dto.isPublished ?? true,
        publishedAt: dto.isPublished === false ? null : new Date(),
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'contentPage.create',
      entityType: 'ContentPage',
      entityId: page.id,
      newValue: { slug: page.slug, title: page.title, isPublished: page.isPublished },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`Content page created: ${page.slug} by ${adminUserId}`);
    return this.toResponse(page);
  }

  async update(
    slug: string,
    dto: UpdateContentPageDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<ContentPageResponseDto> {
    const existing = await this.prisma.contentPage.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Content page not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No content page with slug "${slug}"` },
      ]);
    }

    // Audit-friendly diff: capture the before state, then update.
    const before = {
      title: existing.title,
      contentHtml: existing.contentHtml,
      metaTitle: existing.metaTitle,
      metaDescription: existing.metaDescription,
      isPublished: existing.isPublished,
    };

    const becomingPublished =
      dto.isPublished === true && existing.isPublished === false;

    const updated = await this.prisma.contentPage.update({
      where: { id: existing.id },
      data: {
        title: dto.title ?? undefined,
        contentHtml: dto.contentHtml ?? undefined,
        metaTitle: dto.metaTitle ?? undefined,
        metaDescription: dto.metaDescription ?? undefined,
        isPublished: dto.isPublished ?? undefined,
        // Stamp publishedAt the first time it flips true.
        publishedAt: becomingPublished ? new Date() : undefined,
        updatedByUserId: adminUserId,
      },
    });

    const after = {
      title: updated.title,
      contentHtml: updated.contentHtml,
      metaTitle: updated.metaTitle,
      metaDescription: updated.metaDescription,
      isPublished: updated.isPublished,
    };

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'contentPage.update',
      entityType: 'ContentPage',
      entityId: updated.id,
      oldValue: before,
      newValue: after,
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`Content page updated: ${slug} by ${adminUserId}`);
    return this.toResponse(updated);
  }

  async softDelete(
    slug: string,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.prisma.contentPage.findFirst({
      where: { slug, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Content page not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No content page with slug "${slug}"` },
      ]);
    }

    await this.prisma.contentPage.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'contentPage.delete',
      entityType: 'ContentPage',
      entityId: existing.id,
      oldValue: { slug: existing.slug, title: existing.title },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`Content page deleted: ${slug} by ${adminUserId}`);
  }

  // =========================================================
  // Public (no auth)
  // =========================================================

  /**
   * Public reads gate on `isPublished` so unpublished drafts stay
   * invisible. Returns 404 on either missing OR unpublished — the
   * frontend treats both identically.
   */
  async getPublishedBySlug(slug: string): Promise<ContentPageResponseDto> {
    const page = await this.prisma.contentPage.findFirst({
      where: { slug, deletedAt: null, isPublished: true },
    });
    if (!page) {
      throw new NotFoundException('Content page not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No published page with slug "${slug}"` },
      ]);
    }
    return this.toResponse(page);
  }

  // =========================================================
  // Helpers
  // =========================================================

  private toResponse(page: {
    id: string;
    slug: string;
    title: string;
    contentHtml: string;
    metaTitle: string | null;
    metaDescription: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    updatedByUserId: string | null;
  }): ContentPageResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      contentHtml: page.contentHtml,
      metaTitle: page.metaTitle ?? undefined,
      metaDescription: page.metaDescription ?? undefined,
      isPublished: page.isPublished,
      publishedAt: page.publishedAt ?? undefined,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
      updatedByUserId: page.updatedByUserId ?? undefined,
    };
  }
}
