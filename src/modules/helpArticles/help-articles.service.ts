import { Injectable, Logger } from '@nestjs/common';
import { ActorType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import type {
  CreateHelpArticleDto,
  CreateHelpCategoryDto,
  HelpArticleDetailDto,
  HelpArticleImageResponseDto,
  HelpArticleListItemDto,
  HelpCategoryDeleteResultDto,
  HelpCategoryResponseDto,
  ListHelpArticlesQueryDto,
  ReorderHelpArticlesDto,
  UpdateHelpArticleDto,
  UpdateHelpCategoryDto,
  UpdateHelpImageDto,
} from './dto';

const RESCUE_CATEGORY_KEY = 'getting-started';

/**
 * M11.15 (HELP) — operator training articles.
 *
 * The shape mirrors the FAQ-categories pattern from BUG SS:
 *   - canonical seeded categories are system-protected;
 *   - new categories are admin-created;
 *   - deletes either succeed cleanly (no children) or get a force
 *     flag that reassigns children to "getting-started" before
 *     soft-deleting the category.
 *
 * Article visibility is role-based: every article carries a
 * `visibleToRoles` array (default operator+admin+superAdmin) and the
 * list/detail queries filter on the caller's role. Admins editing
 * pass `includeDrafts=true` to see unpublished rows.
 */
@Injectable()
export class HelpArticlesService {
  private readonly logger = new Logger(HelpArticlesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditLogsService,
  ) {}

  // =========================================================
  // Categories
  // =========================================================

  async listCategories(): Promise<HelpCategoryResponseDto[]> {
    const rows = await this.prisma.helpCategory.findMany({
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    // One groupBy to populate article counts (only published, only
    // non-deleted) — cheaper than N+1.
    const counts = await this.prisma.helpArticle.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, isPublished: true },
      _count: { _all: true },
    });
    const countByCat = new Map<string, number>(
      counts
        .filter((c): c is typeof c & { categoryId: string } => !!c.categoryId)
        .map((c) => [c.categoryId, c._count._all]),
    );
    return rows.map((r) => this.toCategory(r, countByCat.get(r.id) ?? 0));
  }

  async createCategory(
    dto: CreateHelpCategoryDto,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpCategoryResponseDto> {
    const key = dto.key.toLowerCase().trim();
    const existing = await this.prisma.helpCategory.findFirst({ where: { key } });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException('Help category already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: `A help category with key "${key}" already exists.`,
        },
      ]);
    }
    const created = existing
      ? await this.prisma.helpCategory.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            name: dto.name,
            description: dto.description ?? null,
            iconName: dto.iconName ?? null,
            sortOrder: dto.sortOrder ?? 999,
          },
        })
      : await this.prisma.helpCategory.create({
          data: {
            key,
            name: dto.name,
            description: dto.description ?? null,
            iconName: dto.iconName ?? null,
            sortOrder: dto.sortOrder ?? 999,
          },
        });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: existing ? 'helpCategory.revive' : 'helpCategory.create',
      entityType: 'HelpCategory',
      entityId: created.id,
      newValue: { key: created.key, name: created.name },
      ipAddress: ip,
      userAgent,
    });
    return this.toCategory(created, 0);
  }

  async updateCategory(
    id: string,
    dto: UpdateHelpCategoryDto,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpCategoryResponseDto> {
    const row = await this.prisma.helpCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Help category not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No help category with id "${id}"` },
      ]);
    }
    const updated = await this.prisma.helpCategory.update({
      where: { id },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        iconName: dto.iconName ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpCategory.update',
      entityType: 'HelpCategory',
      entityId: id,
      oldValue: { name: row.name, sortOrder: row.sortOrder },
      newValue: { name: updated.name, sortOrder: updated.sortOrder },
      ipAddress: ip,
      userAgent,
    });
    return this.toCategory(updated);
  }

  async deleteCategory(
    id: string,
    force: boolean,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpCategoryDeleteResultDto> {
    const row = await this.prisma.helpCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Help category not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No help category with id "${id}"` },
      ]);
    }
    if (row.isSystem) {
      throw new ForbiddenException('System help category', [
        {
          field: 'id',
          reason: ErrorCodes.FORBIDDEN,
          message: `"${row.name}" is a system category and cannot be deleted.`,
        },
      ]);
    }
    const usageCount = await this.prisma.helpArticle.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (usageCount > 0 && !force) {
      throw new ConflictException('Category has articles', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `${usageCount} article(s) reference this category. Move them or use force=true to reassign to "${RESCUE_CATEGORY_KEY}".`,
        },
      ]);
    }
    if (usageCount > 0 && force) {
      const rescue = await this.prisma.helpCategory.findFirst({
        where: { key: RESCUE_CATEGORY_KEY, deletedAt: null },
        select: { id: true },
      });
      if (!rescue) {
        throw new BadRequestException('Rescue category missing', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message:
              'The "getting-started" rescue category is missing — reseed it before force-deleting.',
          },
        ]);
      }
      await this.prisma.$transaction([
        this.prisma.helpArticle.updateMany({
          where: { categoryId: id, deletedAt: null },
          data: { categoryId: rescue.id },
        }),
        this.prisma.helpCategory.update({
          where: { id },
          data: { deletedAt: new Date() },
        }),
      ]);
    } else {
      await this.prisma.helpCategory.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpCategory.delete',
      entityType: 'HelpCategory',
      entityId: id,
      oldValue: { key: row.key, name: row.name },
      newValue: { force, reassignedArticles: force ? usageCount : 0 },
      ipAddress: ip,
      userAgent,
    });
    return { success: true, reassignedArticles: force ? usageCount : 0 };
  }

  // =========================================================
  // Articles
  // =========================================================

  async listArticles(
    query: ListHelpArticlesQueryDto,
    roleKey: string,
    canManage: boolean,
  ): Promise<HelpArticleListItemDto[]> {
    const where: Prisma.HelpArticleWhereInput = {
      deletedAt: null,
      visibleToRoles: { has: roleKey },
    };
    if (!canManage || !query.includeDrafts) {
      where.isPublished = true;
    }
    if (query.category) {
      where.category = { key: query.category, deletedAt: null };
    }
    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { summary: { contains: term, mode: 'insensitive' } },
        { contentMarkdown: { contains: term, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.helpArticle.findMany({
      where,
      include: {
        category: { select: { key: true, name: true, sortOrder: true } },
        _count: { select: { images: { where: { deletedAt: null } } } },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });
    return rows.map((r) => this.toListItem(r));
  }

  async getArticleBySlug(
    slug: string,
    roleKey: string,
    canManage: boolean,
  ): Promise<HelpArticleDetailDto> {
    const where: Prisma.HelpArticleWhereInput = {
      slug,
      deletedAt: null,
      visibleToRoles: { has: roleKey },
    };
    if (!canManage) {
      where.isPublished = true;
    }
    const row = await this.prisma.helpArticle.findFirst({
      where,
      include: {
        category: { select: { key: true, name: true } },
        images: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
        _count: { select: { images: { where: { deletedAt: null } } } },
      },
    });
    if (!row) {
      throw new NotFoundException('Help article not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: `No article matching slug "${slug}" is visible to your role.`,
        },
      ]);
    }
    // Fire-and-forget view increment. Wrapped so the response is never
    // delayed by the counter write.
    this.prisma.helpArticle
      .update({ where: { id: row.id }, data: { viewCount: { increment: 1 } } })
      .catch((err) => {
        this.logger.warn(
          `[M11.15] viewCount increment failed for ${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      });
    return this.toDetail(row);
  }

  async createArticle(
    dto: CreateHelpArticleDto,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpArticleDetailDto> {
    const slug = (dto.slug || this.slugify(dto.title)).toLowerCase();
    if (!slug) {
      throw new BadRequestException('Slug could not be derived', [
        { field: 'slug', reason: ErrorCodes.BAD_REQUEST, message: 'Slug is required.' },
      ]);
    }
    const existing = await this.prisma.helpArticle.findFirst({
      where: { slug, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Article slug already in use', [
        {
          field: 'slug',
          reason: ErrorCodes.CONFLICT,
          message: `An article with slug "${slug}" already exists.`,
        },
      ]);
    }
    const { provider, normalizedUrl } = this.parseVideoUrl(dto.videoUrl);
    const created = await this.prisma.helpArticle.create({
      data: {
        slug,
        title: dto.title.trim(),
        categoryId: dto.categoryId ?? null,
        summary: dto.summary?.trim() ?? null,
        contentMarkdown: dto.contentMarkdown ?? null,
        contentHtml: dto.contentHtml ?? this.renderMarkdown(dto.contentMarkdown),
        videoUrl: normalizedUrl,
        videoProvider: provider,
        sortOrder: dto.sortOrder ?? 0,
        isPublished: dto.isPublished ?? false,
        tags: dto.tags ?? [],
        visibleToRoles:
          dto.visibleToRoles && dto.visibleToRoles.length > 0
            ? dto.visibleToRoles
            : ['operator', 'admin', 'superAdmin'],
        createdBy: actorUserId,
        updatedBy: actorUserId,
      },
      include: {
        category: { select: { key: true, name: true } },
        images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { images: { where: { deletedAt: null } } } },
      },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticle.create',
      entityType: 'HelpArticle',
      entityId: created.id,
      newValue: { slug: created.slug, title: created.title, isPublished: created.isPublished },
      ipAddress: ip,
      userAgent,
    });
    return this.toDetail(created);
  }

  async updateArticle(
    id: string,
    dto: UpdateHelpArticleDto,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpArticleDetailDto> {
    const row = await this.prisma.helpArticle.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Article not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No article with id "${id}"` },
      ]);
    }
    let nextSlug = row.slug;
    if (dto.slug && dto.slug !== row.slug) {
      nextSlug = dto.slug.toLowerCase();
      const dup = await this.prisma.helpArticle.findFirst({
        where: { slug: nextSlug, deletedAt: null, id: { not: id } },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException('Slug in use', [
          {
            field: 'slug',
            reason: ErrorCodes.CONFLICT,
            message: `Another article already uses slug "${nextSlug}".`,
          },
        ]);
      }
    }
    const data: Prisma.HelpArticleUpdateInput = {
      slug: nextSlug,
      title: dto.title ?? undefined,
      category: dto.categoryId === undefined ? undefined : dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true },
      summary: dto.summary ?? undefined,
      contentMarkdown: dto.contentMarkdown ?? undefined,
      contentHtml:
        dto.contentHtml ??
        (dto.contentMarkdown !== undefined
          ? this.renderMarkdown(dto.contentMarkdown)
          : undefined),
      sortOrder: dto.sortOrder ?? undefined,
      isPublished: dto.isPublished ?? undefined,
      tags: dto.tags ?? undefined,
      visibleToRoles:
        dto.visibleToRoles && dto.visibleToRoles.length > 0
          ? dto.visibleToRoles
          : undefined,
      updater: { connect: { id: actorUserId } },
    };
    if (dto.videoUrl !== undefined) {
      const { provider, normalizedUrl } = this.parseVideoUrl(dto.videoUrl);
      data.videoUrl = normalizedUrl;
      data.videoProvider = provider;
    }
    const updated = await this.prisma.helpArticle.update({
      where: { id },
      data,
      include: {
        category: { select: { key: true, name: true } },
        images: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        _count: { select: { images: { where: { deletedAt: null } } } },
      },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticle.update',
      entityType: 'HelpArticle',
      entityId: id,
      oldValue: { title: row.title, isPublished: row.isPublished, slug: row.slug },
      newValue: {
        title: updated.title,
        isPublished: updated.isPublished,
        slug: updated.slug,
      },
      ipAddress: ip,
      userAgent,
    });
    return this.toDetail(updated);
  }

  async deleteArticle(
    id: string,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{ success: true }> {
    const row = await this.prisma.helpArticle.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Article not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No article with id "${id}"` },
      ]);
    }
    await this.prisma.helpArticle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticle.delete',
      entityType: 'HelpArticle',
      entityId: id,
      oldValue: { slug: row.slug, title: row.title },
      ipAddress: ip,
      userAgent,
    });
    return { success: true };
  }

  async reorderArticles(
    dto: ReorderHelpArticlesDto,
    actorUserId: string,
  ): Promise<{ success: true; updated: number }> {
    const updates = dto.orderedIds.map((id, idx) =>
      this.prisma.helpArticle.update({
        where: { id },
        data: { sortOrder: idx },
      }),
    );
    await this.prisma.$transaction(updates);
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticle.reorder',
      entityType: 'HelpArticle',
      entityId: '*',
      newValue: { count: dto.orderedIds.length },
    });
    return { success: true, updated: dto.orderedIds.length };
  }

  // =========================================================
  // Images
  // =========================================================

  /**
   * M11.15-HELP-V2 — Inline image upload for the TipTap editor.
   *
   * Unlike `uploadImage` below, this DOESN'T link to the
   * help_article_images table. The editor inserts the returned URL
   * directly into the article HTML; the image lives at
   *   uploads/help/inline/<articleId>/<storage-key>
   * so a future "delete article" cron can clean both the gallery
   * folder AND this folder in one sweep.
   *
   * articleId is optional — on the "new article" page we don't have
   * one yet, so the editor passes 'draft' and the file lands in
   * uploads/help/inline/draft/. Drafts can be moved during the
   * first save if we ever wire that up; for now the path stays.
   */
  async uploadInlineImage(
    articleId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    actorUserId: string,
  ): Promise<{ url: string; alt: string }> {
    if (!/^image\//i.test(file.mimetype)) {
      throw new BadRequestException('Unsupported image type', [
        {
          field: 'file',
          reason: ErrorCodes.BAD_REQUEST,
          message: `Expected image/*, got ${file.mimetype}.`,
        },
      ]);
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image too large', [
        {
          field: 'file',
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Maximum image size is 10 MB.',
        },
      ]);
    }
    const safeArticle = /^[a-z0-9-]+$/i.test(articleId) ? articleId : 'draft';
    const upload = await this.storage.upload(file.buffer, {
      contentType: file.mimetype,
      prefix: `help/inline/${safeArticle}`,
      originalFilename: file.originalname,
      metadata: { articleId: safeArticle, inline: 'true', uploader: actorUserId },
    });
    return {
      url: this.toPublicUrl(upload.storageKey),
      alt: file.originalname.replace(/\.[^.]+$/, ''),
    };
  }

  async uploadImage(
    articleId: string,
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    caption: string | undefined,
    altText: string | undefined,
    sortOrder: number | undefined,
    actorUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<HelpArticleImageResponseDto> {
    const article = await this.prisma.helpArticle.findFirst({
      where: { id: articleId, deletedAt: null },
    });
    if (!article) {
      throw new NotFoundException('Article not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No article with id "${articleId}"` },
      ]);
    }
    if (!/^image\//i.test(file.mimetype)) {
      throw new BadRequestException('Unsupported image type', [
        {
          field: 'file',
          reason: ErrorCodes.BAD_REQUEST,
          message: `Expected image/*, got ${file.mimetype}.`,
        },
      ]);
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Image too large', [
        {
          field: 'file',
          reason: ErrorCodes.BAD_REQUEST,
          message: 'Maximum image size is 10 MB.',
        },
      ]);
    }

    const upload = await this.storage.upload(file.buffer, {
      contentType: file.mimetype,
      prefix: `help/${articleId}`,
      originalFilename: file.originalname,
      metadata: { articleId },
    });

    let nextOrder = sortOrder;
    if (nextOrder === undefined) {
      const max = await this.prisma.helpArticleImage.aggregate({
        where: { articleId, deletedAt: null },
        _max: { sortOrder: true },
      });
      nextOrder = (max._max.sortOrder ?? -1) + 1;
    }

    const created = await this.prisma.helpArticleImage.create({
      data: {
        articleId,
        storageKey: upload.storageKey,
        fileSize: upload.size,
        mimeType: file.mimetype,
        caption: caption ?? null,
        altText: altText ?? null,
        sortOrder: nextOrder,
      },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticleImage.create',
      entityType: 'HelpArticleImage',
      entityId: created.id,
      newValue: { articleId, size: upload.size, key: upload.storageKey },
      ipAddress: ip,
      userAgent,
    });
    return this.toImage(created);
  }

  async updateImage(
    articleId: string,
    imageId: string,
    dto: UpdateHelpImageDto,
    actorUserId: string,
  ): Promise<HelpArticleImageResponseDto> {
    const row = await this.prisma.helpArticleImage.findFirst({
      where: { id: imageId, articleId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Image not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No image with id "${imageId}"` },
      ]);
    }
    const updated = await this.prisma.helpArticleImage.update({
      where: { id: imageId },
      data: {
        caption: dto.caption ?? undefined,
        altText: dto.altText ?? undefined,
        sortOrder: dto.sortOrder ?? undefined,
      },
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticleImage.update',
      entityType: 'HelpArticleImage',
      entityId: imageId,
      oldValue: {
        caption: row.caption,
        altText: row.altText,
        sortOrder: row.sortOrder,
      },
      newValue: {
        caption: updated.caption,
        altText: updated.altText,
        sortOrder: updated.sortOrder,
      },
    });
    return this.toImage(updated);
  }

  async deleteImage(
    articleId: string,
    imageId: string,
    actorUserId: string,
  ): Promise<{ success: true }> {
    const row = await this.prisma.helpArticleImage.findFirst({
      where: { id: imageId, articleId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Image not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No image with id "${imageId}"` },
      ]);
    }
    await this.prisma.helpArticleImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });
    this.storage.delete(row.storageKey).catch((err) => {
      this.logger.warn(
        `[M11.15] storage delete failed for ${row.storageKey}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
    await this.audit.create({
      actorUserId,
      actorType: ActorType.USER,
      actionKey: 'helpArticleImage.delete',
      entityType: 'HelpArticleImage',
      entityId: imageId,
      oldValue: { articleId, storageKey: row.storageKey },
    });
    return { success: true };
  }

  // =========================================================
  // Helpers
  // =========================================================

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 150);
  }

  /**
   * Minimal markdown → HTML for the admin-authored placeholder text.
   * The frontend's TipTap editor already emits HTML so for most edits
   * we just store that directly via `contentHtml`. This routine is the
   * fallback when an admin (or a CLI seed) pastes raw markdown.
   */
  private renderMarkdown(md: string | undefined | null): string {
    if (!md) return '';
    const escape = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let inPara = false;
    const closeList = () => {
      if (inList && listType) {
        out.push(`</${listType}>`);
        inList = false;
        listType = null;
      }
    };
    const closePara = () => {
      if (inPara) {
        out.push('</p>');
        inPara = false;
      }
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        closeList();
        closePara();
        continue;
      }
      const hMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (hMatch) {
        closeList();
        closePara();
        const level = hMatch[1].length;
        out.push(`<h${level}>${this.inlineFmt(escape(hMatch[2]))}</h${level}>`);
        continue;
      }
      const olMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (olMatch) {
        closePara();
        if (!inList || listType !== 'ol') {
          closeList();
          out.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        out.push(`<li>${this.inlineFmt(escape(olMatch[2]))}</li>`);
        continue;
      }
      const ulMatch = line.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        closePara();
        if (!inList || listType !== 'ul') {
          closeList();
          out.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        out.push(`<li>${this.inlineFmt(escape(ulMatch[1]))}</li>`);
        continue;
      }
      closeList();
      if (!inPara) {
        out.push('<p>');
        inPara = true;
      } else {
        out.push(' ');
      }
      out.push(this.inlineFmt(escape(line)));
    }
    closeList();
    closePara();
    return out.join('');
  }

  private inlineFmt(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  private parseVideoUrl(url: string | undefined): {
    provider: string | null;
    normalizedUrl: string | null;
  } {
    if (!url || !url.trim()) return { provider: null, normalizedUrl: null };
    const trimmed = url.trim();
    if (/youtube\.com|youtu\.be/i.test(trimmed)) {
      return { provider: 'youtube', normalizedUrl: trimmed };
    }
    if (/vimeo\.com/i.test(trimmed)) {
      return { provider: 'vimeo', normalizedUrl: trimmed };
    }
    return { provider: 'direct', normalizedUrl: trimmed };
  }

  private toPublicUrl(storageKey: string): string {
    if (/^https?:\/\//i.test(storageKey)) return storageKey;
    const base = this.storage.getBaseUrl().replace(/\/$/, '');
    const key = storageKey.replace(/^\/+/, '');
    return `${base}/${key}`;
  }

  private toCategory(
    row: {
      id: string;
      key: string;
      name: string;
      description: string | null;
      iconName: string | null;
      sortOrder: number;
      isSystem: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    articleCount?: number,
  ): HelpCategoryResponseDto {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description,
      iconName: row.iconName,
      sortOrder: row.sortOrder,
      isSystem: row.isSystem,
      articleCount,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toListItem(row: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    isPublished: boolean;
    sortOrder: number;
    tags: string[];
    viewCount: number;
    videoUrl: string | null;
    visibleToRoles: string[];
    updatedAt: Date;
    category: { key: string; name: string; sortOrder: number } | null;
    _count: { images: number };
  }): HelpArticleListItemDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      categoryKey: row.category?.key ?? null,
      categoryName: row.category?.name ?? null,
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      tags: row.tags,
      viewCount: row.viewCount,
      hasVideo: !!row.videoUrl,
      imageCount: row._count.images,
      visibleToRoles: row.visibleToRoles,
      updatedAt: row.updatedAt,
    };
  }

  private toDetail(row: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    isPublished: boolean;
    sortOrder: number;
    tags: string[];
    viewCount: number;
    visibleToRoles: string[];
    updatedAt: Date;
    createdAt: Date;
    contentHtml: string | null;
    contentMarkdown: string | null;
    videoUrl: string | null;
    videoProvider: string | null;
    createdBy: string | null;
    updatedBy: string | null;
    category: { key: string; name: string } | null;
    images: Array<{
      id: string;
      storageKey: string;
      caption: string | null;
      altText: string | null;
      sortOrder: number;
      createdAt: Date;
    }>;
    _count: { images: number };
  }): HelpArticleDetailDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      categoryKey: row.category?.key ?? null,
      categoryName: row.category?.name ?? null,
      isPublished: row.isPublished,
      sortOrder: row.sortOrder,
      tags: row.tags,
      viewCount: row.viewCount,
      hasVideo: !!row.videoUrl,
      imageCount: row._count.images,
      visibleToRoles: row.visibleToRoles,
      contentHtml: row.contentHtml,
      contentMarkdown: row.contentMarkdown,
      videoUrl: row.videoUrl,
      videoProvider: row.videoProvider,
      images: row.images.map((img) => this.toImage(img)),
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toImage(row: {
    id: string;
    storageKey: string;
    caption: string | null;
    altText: string | null;
    sortOrder: number;
    createdAt: Date;
  }): HelpArticleImageResponseDto {
    return {
      id: row.id,
      url: this.toPublicUrl(row.storageKey),
      caption: row.caption,
      altText: row.altText,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
    };
  }
}
