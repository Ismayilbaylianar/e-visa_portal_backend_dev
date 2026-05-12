import { Injectable, Logger } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import {
  CreateFaqCategoryDto,
  CreateFaqItemDto,
  FaqCategoryDeleteResultDto,
  FaqCategoryListResponseDto,
  FaqCategoryResponseDto,
  FaqGroupedResponseDto,
  FaqItemListResponseDto,
  FaqItemResponseDto,
  ReorderFaqItemsDto,
  UpdateFaqCategoryDto,
  UpdateFaqItemDto,
} from './dto';

// M11.14 (BUG SS) — the categories seeded by migrations 14 + 24 are
// system-protected: rename + reorder allowed, delete blocked. Keep
// this list in sync with the migration's INSERT VALUES.
const SYSTEM_CATEGORY_KEYS = new Set<string>([
  'general',
  'visa',
  'application',
  'payment',
  'support',
  'other',
]);
const RESCUE_CATEGORY_KEY = 'general';

/**
 * Module 11.B — FAQ items.
 *
 * Per-category drag-drop reorder via the bulk endpoint. The public
 * view groups by category and orders within group by `displayOrder`.
 */
@Injectable()
export class FaqItemsService {
  private readonly logger = new Logger(FaqItemsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // =========================================================
  // Admin
  // =========================================================

  async list(category?: string): Promise<FaqItemListResponseDto> {
    const items = await this.prisma.faqItem.findMany({
      where: {
        deletedAt: null,
        category: category ?? undefined,
      },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    });
    return {
      items: items.map((i) => this.toResponse(i)),
      total: items.length,
    };
  }

  async getById(id: string): Promise<FaqItemResponseDto> {
    const item = await this.prisma.faqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException('FAQ item not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No FAQ item with id "${id}"` },
      ]);
    }
    return this.toResponse(item);
  }

  async create(
    dto: CreateFaqItemDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqItemResponseDto> {
    // Default sort key: append to the end of the chosen category so
    // new items don't visually reorder existing ones.
    let displayOrder = dto.displayOrder;
    if (displayOrder === undefined) {
      const max = await this.prisma.faqItem.aggregate({
        where: { category: dto.category ?? null, deletedAt: null },
        _max: { displayOrder: true },
      });
      displayOrder = (max._max.displayOrder ?? -1) + 1;
    }

    const item = await this.prisma.faqItem.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        category: dto.category,
        displayOrder,
        isPublished: dto.isPublished ?? true,
        createdByUserId: adminUserId,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqItem.create',
      entityType: 'FaqItem',
      entityId: item.id,
      newValue: { question: item.question, category: item.category, displayOrder: item.displayOrder },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`FAQ item created: ${item.id} by ${adminUserId}`);
    return this.toResponse(item);
  }

  async update(
    id: string,
    dto: UpdateFaqItemDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqItemResponseDto> {
    const existing = await this.prisma.faqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('FAQ item not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No FAQ item with id "${id}"` },
      ]);
    }

    const before = {
      question: existing.question,
      answer: existing.answer,
      category: existing.category,
      displayOrder: existing.displayOrder,
      isPublished: existing.isPublished,
    };

    const updated = await this.prisma.faqItem.update({
      where: { id },
      data: {
        question: dto.question ?? undefined,
        answer: dto.answer ?? undefined,
        category: dto.category ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        isPublished: dto.isPublished ?? undefined,
        updatedByUserId: adminUserId,
      },
    });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqItem.update',
      entityType: 'FaqItem',
      entityId: updated.id,
      oldValue: before,
      newValue: {
        question: updated.question,
        answer: updated.answer,
        category: updated.category,
        displayOrder: updated.displayOrder,
        isPublished: updated.isPublished,
      },
      ipAddress: ip,
      userAgent,
    });

    return this.toResponse(updated);
  }

  async softDelete(
    id: string,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<void> {
    const existing = await this.prisma.faqItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('FAQ item not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No FAQ item with id "${id}"` },
      ]);
    }
    await this.prisma.faqItem.update({
      where: { id },
      data: { deletedAt: new Date(), updatedByUserId: adminUserId },
    });
    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqItem.delete',
      entityType: 'FaqItem',
      entityId: existing.id,
      oldValue: { question: existing.question, category: existing.category },
      ipAddress: ip,
      userAgent,
    });
  }

  /**
   * Bulk reorder. Accepts a list of {id, displayOrder} pairs and
   * applies all updates in one transaction so partial failures don't
   * leave the list in a half-sorted state.
   */
  async reorder(
    dto: ReorderFaqItemsDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqItemListResponseDto> {
    const ids = dto.items.map((i) => i.id);
    const existing = await this.prisma.faqItem.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      const missing = ids.filter((id) => !existing.some((e) => e.id === id));
      throw new NotFoundException('Some FAQ items not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `Missing ids: ${missing.join(', ')}` },
      ]);
    }

    await this.prisma.$transaction(
      dto.items.map((i) =>
        this.prisma.faqItem.update({
          where: { id: i.id },
          data: { displayOrder: i.displayOrder, updatedByUserId: adminUserId },
        }),
      ),
    );

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqItem.reorder',
      entityType: 'FaqItem',
      // Bulk action — pin the audit row to the first id so the audit
      // detail still has something to look up. The full payload lives
      // in newValue.
      entityId: dto.items[0].id,
      newValue: { reorderedItems: dto.items },
      ipAddress: ip,
      userAgent,
    });

    this.logger.log(`FAQ items reordered: ${dto.items.length} items by ${adminUserId}`);
    return this.list();
  }

  // =========================================================
  // Public (no auth) — grouped by category
  // =========================================================

  async listPublishedGrouped(): Promise<FaqGroupedResponseDto> {
    // M11.7 (C1) — Items + categories load in parallel. We sort the
    // resulting groups by FaqCategory.displayOrder so the admin can
    // reorder the homepage FAQ without re-publishing every item, and
    // we use FaqCategory.displayName for the section header.
    const [items, categories] = await Promise.all([
      this.prisma.faqItem.findMany({
        where: { deletedAt: null, isPublished: true },
        orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
      }),
      this.prisma.faqCategory.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
    ]);

    const categoryByKey = new Map(categories.map((c) => [c.key, c]));

    // Bucket by category. Items reference categories by key; unknown
    // keys still render under their raw value so we never silently
    // drop items if an admin removes a category that had stragglers.
    const buckets = new Map<string, FaqGroupedResponseDto['groups'][number]>();
    for (const item of items) {
      const cat = item.category ?? 'other';
      if (!buckets.has(cat)) {
        const meta = categoryByKey.get(cat);
        buckets.set(cat, {
          category: cat,
          displayName: meta?.displayName,
          items: [],
        });
      }
      buckets.get(cat)!.items.push({
        id: item.id,
        question: item.question,
        answer: item.answer,
        displayOrder: item.displayOrder,
      });
    }

    // Order groups by FaqCategory.displayOrder; unknown keys go to
    // the end (Number.MAX_SAFE_INTEGER) so legacy items never push
    // ahead of admin-curated categories.
    const ordered = Array.from(buckets.values()).sort((a, b) => {
      const ao = categoryByKey.get(a.category)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = categoryByKey.get(b.category)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return ao - bo;
    });
    return { groups: ordered };
  }

  // =========================================================
  // M11.7 (C1) — Categories: admin CRUD-lite (rename / reorder /
  // toggle active). We don't expose create/delete for now: the
  // migration seeds the canonical set, and renaming an existing
  // category is the common case. If the admin needs a brand-new
  // category they can edit one of the seeded slots.
  // =========================================================

  async listCategories(
    includeFaqCount = true,
  ): Promise<FaqCategoryListResponseDto> {
    const items = await this.prisma.faqCategory.findMany({
      where: { deletedAt: null },
      orderBy: { displayOrder: 'asc' },
    });

    // M11.14 (BUG SS) — one aggregate query for all categories,
    // grouped by faq_items.category. Cheaper than a count-per-row N+1
    // and the result map is tiny (one entry per active category).
    const faqCounts = includeFaqCount
      ? await this.prisma.faqItem.groupBy({
          by: ['category'],
          where: { deletedAt: null },
          _count: { _all: true },
        })
      : [];
    const countByKey = new Map<string, number>(
      faqCounts
        .filter((row): row is typeof row & { category: string } => !!row.category)
        .map((row) => [row.category, row._count._all]),
    );

    return {
      items: items.map((row) =>
        this.toCategoryResponse(row, countByKey.get(row.key) ?? 0),
      ),
      total: items.length,
    };
  }

  /**
   * M11.14 (BUG SS) — create a new FAQ category. Slug uniqueness is
   * enforced both by the schema's unique index on `key` and by a
   * pre-check here so the response is a clean 409 instead of a P2002.
   */
  async createCategory(
    dto: CreateFaqCategoryDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqCategoryResponseDto> {
    const key = dto.key.toLowerCase().trim();
    const existing = await this.prisma.faqCategory.findFirst({
      where: { key },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException('FAQ category already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: `A FAQ category with key "${key}" already exists.`,
        },
      ]);
    }

    // If a soft-deleted row exists with the same key, revive it
    // (the unique index on `key` is global, not deleted-aware, so we
    // can't INSERT another row with the same key).
    const created = existing
      ? await this.prisma.faqCategory.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            displayName: dto.displayName,
            displayOrder: dto.displayOrder ?? 999,
            isActive: dto.isActive ?? true,
          },
        })
      : await this.prisma.faqCategory.create({
          data: {
            key,
            displayName: dto.displayName,
            displayOrder: dto.displayOrder ?? 999,
            isActive: dto.isActive ?? true,
          },
        });

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: existing ? 'faqCategory.revive' : 'faqCategory.create',
      entityType: 'FaqCategory',
      entityId: created.id,
      newValue: {
        key: created.key,
        displayName: created.displayName,
        displayOrder: created.displayOrder,
        isActive: created.isActive,
      },
      ipAddress: ip,
      userAgent,
    });

    return this.toCategoryResponse(created, 0);
  }

  /**
   * M11.14 (BUG SS) — soft-delete a FAQ category. Three guards:
   *   1. System categories (the seeded canonical set) can never be
   *      deleted, regardless of force. Admins rely on these always
   *      existing for the public /faq page.
   *   2. Without `force`, categories with attached FAQs are blocked
   *      so the admin doesn't accidentally orphan content.
   *   3. With `force`, attached FAQs are reassigned to the "general"
   *      rescue category in the same transaction. If general is
   *      somehow gone, we surface a 400 instead of orphaning.
   */
  async deleteCategory(
    id: string,
    force: boolean,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqCategoryDeleteResultDto> {
    const category = await this.prisma.faqCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException('FAQ category not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No FAQ category with id "${id}"` },
      ]);
    }

    if (SYSTEM_CATEGORY_KEYS.has(category.key)) {
      throw new ForbiddenException('System FAQ category', [
        {
          field: 'id',
          reason: ErrorCodes.FORBIDDEN,
          message: `"${category.displayName}" is a system category and cannot be deleted. Rename or hide it instead.`,
        },
      ]);
    }

    const usageCount = await this.prisma.faqItem.count({
      where: { category: category.key, deletedAt: null },
    });
    if (usageCount > 0 && !force) {
      throw new ConflictException('Category has FAQ items', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `${usageCount} FAQ item(s) reference this category. Move them to another category or use force=true to reassign them to "General".`,
        },
      ]);
    }

    if (usageCount > 0 && force) {
      const rescue = await this.prisma.faqCategory.findFirst({
        where: { key: RESCUE_CATEGORY_KEY, deletedAt: null },
        select: { key: true },
      });
      if (!rescue) {
        throw new BadRequestException('Rescue category missing', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message:
              'The "General" rescue category is missing — reseed it before force-deleting.',
          },
        ]);
      }
    }

    await this.prisma.$transaction([
      ...(usageCount > 0 && force
        ? [
            this.prisma.faqItem.updateMany({
              where: { category: category.key, deletedAt: null },
              data: { category: RESCUE_CATEGORY_KEY },
            }),
          ]
        : []),
      this.prisma.faqCategory.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
    ]);

    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqCategory.delete',
      entityType: 'FaqCategory',
      entityId: id,
      oldValue: {
        key: category.key,
        displayName: category.displayName,
        displayOrder: category.displayOrder,
        isActive: category.isActive,
      },
      newValue: { force, reassignedFaqs: force ? usageCount : 0 },
      ipAddress: ip,
      userAgent,
    });

    return { success: true, reassignedFaqs: force ? usageCount : 0 };
  }

  async updateCategory(
    id: string,
    dto: UpdateFaqCategoryDto,
    adminUserId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<FaqCategoryResponseDto> {
    const existing = await this.prisma.faqCategory.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('FAQ category not found', [
        { reason: ErrorCodes.NOT_FOUND, message: `No FAQ category with id "${id}"` },
      ]);
    }
    const before = {
      displayName: existing.displayName,
      displayOrder: existing.displayOrder,
      isActive: existing.isActive,
    };
    const updated = await this.prisma.faqCategory.update({
      where: { id },
      data: {
        displayName: dto.displayName ?? undefined,
        displayOrder: dto.displayOrder ?? undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
    await this.auditLogsService.create({
      actorUserId: adminUserId,
      actorType: ActorType.USER,
      actionKey: 'faqCategory.update',
      entityType: 'FaqCategory',
      entityId: updated.id,
      oldValue: before,
      newValue: {
        displayName: updated.displayName,
        displayOrder: updated.displayOrder,
        isActive: updated.isActive,
      },
      ipAddress: ip,
      userAgent,
    });
    return this.toCategoryResponse(updated);
  }

  private toCategoryResponse(
    row: {
      id: string;
      key: string;
      displayName: string;
      displayOrder: number;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    },
    faqCount?: number,
  ): FaqCategoryResponseDto {
    return {
      id: row.id,
      key: row.key,
      displayName: row.displayName,
      displayOrder: row.displayOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // M11.14 (BUG SS) — admin UI surfaces.
      faqCount,
      isSystem: SYSTEM_CATEGORY_KEYS.has(row.key),
    };
  }

  // =========================================================
  // Helpers
  // =========================================================

  private toResponse(row: {
    id: string;
    question: string;
    answer: string;
    category: string | null;
    displayOrder: number;
    isPublished: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): FaqItemResponseDto {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      category: row.category ?? undefined,
      displayOrder: row.displayOrder,
      isPublished: row.isPublished,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
