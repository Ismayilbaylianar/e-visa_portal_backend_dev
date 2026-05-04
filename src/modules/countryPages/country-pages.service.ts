import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { StorageService } from '../storage/storage.service';
import {
  CreateCountryPageDto,
  UpdateCountryPageDto,
  GetCountryPagesQueryDto,
  CountryPageResponseDto,
  CountryPageListResponseDto,
  PublicCountryPageResponseDto,
  PublicCountryPageListResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * Module 1.5 — manages publishable marketing pages per Country.
 *
 * Each Country can have at most one CountryPage (`countryId` is unique on
 * the page table). Sections are children of CountryPage and cascade-delete
 * by FK on hard-delete; this service uses soft-delete and propagates
 * `deletedAt` to child sections explicitly.
 *
 * Delete is safe — TemplateBindings, BindingNationalityFees, and
 * Applications all reference Country, not CountryPage. Removing a page
 * never breaks an upstream FK.
 */
@Injectable()
export class CountryPagesService {
  private readonly logger = new Logger(CountryPagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(query: GetCountryPagesQueryDto): Promise<CountryPageListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'slug', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    if (query.countryId) where.countryId = query.countryId;
    if (search) {
      where.OR = [
        { slug: { contains: search, mode: 'insensitive' } },
        { country: { name: { contains: search, mode: 'insensitive' } } },
        { country: { isoCode: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [pages, total] = await Promise.all([
      this.prisma.countryPage.findMany({
        where,
        include: {
          country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
          sections: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.countryPage.count({ where }),
    ]);

    return {
      items: pages.map((p) => this.mapToResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<CountryPageResponseDto> {
    const page = await this.prisma.countryPage.findFirst({
      where: { id, deletedAt: null },
      include: {
        country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Page does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(page);
  }

  async create(
    dto: CreateCountryPageDto,
    actorUserId?: string,
  ): Promise<CountryPageResponseDto> {
    // 1. Country must exist
    const country = await this.prisma.country.findFirst({
      where: { id: dto.countryId, deletedAt: null },
    });
    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'The referenced country does not exist',
        },
      ]);
    }

    // 2. One page per country
    const existingForCountry = await this.prisma.countryPage.findFirst({
      where: { countryId: dto.countryId, deletedAt: null },
    });
    if (existingForCountry) {
      throw new ConflictException('Country already has a page', [
        {
          field: 'countryId',
          reason: ErrorCodes.CONFLICT,
          message: 'A CountryPage already exists for this country',
        },
      ]);
    }

    // 3. Slug must be globally unique
    const existingBySlug = await this.prisma.countryPage.findFirst({
      where: { slug: dto.slug },
    });
    if (existingBySlug) {
      throw new ConflictException('Slug already exists', [
        {
          field: 'slug',
          reason: ErrorCodes.CONFLICT,
          message: 'A CountryPage with this slug already exists',
        },
      ]);
    }

    const page = await this.prisma.countryPage.create({
      data: {
        countryId: dto.countryId,
        slug: dto.slug,
        isActive: dto.isActive ?? true,
        isPublished: dto.isPublished ?? false,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: {
        country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
        sections: true,
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countryPage.create',
        'CountryPage',
        page.id,
        undefined,
        {
          countryId: page.countryId,
          isoCode: country.isoCode,
          slug: page.slug,
          isPublished: page.isPublished,
          isActive: page.isActive,
        },
      );
    }

    this.logger.log(`CountryPage created: ${page.id} (${page.slug})`);
    return this.mapToResponse(page);
  }

  async update(
    id: string,
    dto: UpdateCountryPageDto,
    actorUserId?: string,
  ): Promise<CountryPageResponseDto> {
    const page = await this.prisma.countryPage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Page does not exist or has been deleted' },
      ]);
    }

    if (dto.slug && dto.slug !== page.slug) {
      const existingBySlug = await this.prisma.countryPage.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });
      if (existingBySlug) {
        throw new ConflictException('Slug already exists', [
          {
            field: 'slug',
            reason: ErrorCodes.CONFLICT,
            message: 'Another CountryPage already uses this slug',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isPublished !== undefined) updateData.isPublished = dto.isPublished;
    if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) updateData.seoDescription = dto.seoDescription;

    const updated = await this.prisma.countryPage.update({
      where: { id },
      data: updateData,
      include: {
        country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countryPage.update',
        'CountryPage',
        id,
        {
          slug: page.slug,
          isPublished: page.isPublished,
          isActive: page.isActive,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
        },
        {
          slug: updated.slug,
          isPublished: updated.isPublished,
          isActive: updated.isActive,
          seoTitle: updated.seoTitle,
          seoDescription: updated.seoDescription,
        },
      );
    }

    this.logger.log(`CountryPage updated: ${id}`);
    return this.mapToResponse(updated);
  }

  async delete(id: string, actorUserId?: string): Promise<void> {
    const page = await this.prisma.countryPage.findFirst({
      where: { id, deletedAt: null },
    });
    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Page does not exist or has been deleted' },
      ]);
    }

    // Soft delete page + cascade soft-delete sections.
    await this.prisma.$transaction([
      this.prisma.countryPage.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.countrySection.updateMany({
        where: { countryPageId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countryPage.delete',
        'CountryPage',
        id,
        {
          countryId: page.countryId,
          slug: page.slug,
          isPublished: page.isPublished,
        },
        undefined,
      );
    }

    this.logger.log(`CountryPage soft-deleted: ${id}`);
  }

  // ============================================================
  // Public read methods
  // ============================================================

  async findAllPublic(): Promise<PublicCountryPageListResponseDto> {
    const pages = await this.prisma.countryPage.findMany({
      where: { deletedAt: null, isActive: true, isPublished: true },
      include: {
        country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
        sections: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { slug: 'asc' },
    });

    return {
      items: pages.map((p) => this.mapToPublicResponse(p)),
      total: pages.length,
    };
  }

  async findBySlugPublic(slug: string): Promise<PublicCountryPageResponseDto> {
    const page = await this.prisma.countryPage.findFirst({
      where: { slug, deletedAt: null, isActive: true, isPublished: true },
      include: {
        country: { select: { id: true, isoCode: true, name: true, flagEmoji: true } },
        sections: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        // M11.1 — published hero images, ordered for the slider.
        images: {
          where: { deletedAt: null, isPublished: true },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Page does not exist or is not published' },
      ]);
    }

    // M11.1 — visa types with active bindings for this destination,
    // joined to fees so the public card grid can show "from $X". The
    // displayed price is the lowest active total fee across all
    // nationalities (purely a display hint — actual nationality-aware
    // pricing flows through the cascade preview endpoint at apply time).
    const bindings = await this.prisma.templateBinding.findMany({
      where: {
        destinationCountryId: page.country.id,
        isActive: true,
        deletedAt: null,
        visaType: { isActive: true, deletedAt: null },
      },
      select: {
        visaType: {
          select: {
            id: true,
            purpose: true,
            label: true,
            validityDays: true,
            maxStay: true,
            entries: true,
            sortOrder: true,
          },
        },
        nationalityFees: {
          where: { isActive: true, deletedAt: null },
          select: {
            governmentFeeAmount: true,
            serviceFeeAmount: true,
            currencyCode: true,
          },
        },
      },
    });

    const visaTypes = bindings
      .filter((b) => b.visaType)
      .map((b) => {
        const totals = b.nationalityFees.map((f) => ({
          total: Number(f.governmentFeeAmount) + Number(f.serviceFeeAmount),
          currencyCode: f.currencyCode,
        }));
        // Pick the cheapest total across nationalities for the "from X" hint.
        const cheapest = totals.reduce<typeof totals[number] | undefined>(
          (acc, cur) => (acc === undefined || cur.total < acc.total ? cur : acc),
          undefined,
        );
        return {
          id: b.visaType!.id,
          purpose: b.visaType!.purpose,
          label: b.visaType!.label,
          validityDays: b.visaType!.validityDays,
          maxStay: b.visaType!.maxStay,
          entries: b.visaType!.entries,
          fromAmount: cheapest ? cheapest.total.toFixed(2) : undefined,
          currencyCode: cheapest?.currencyCode,
          // Carry sortOrder so we can order client-friendly below.
          _sortOrder: b.visaType!.sortOrder,
        };
      })
      .sort((a, b) => a._sortOrder - b._sortOrder)
      .map(({ _sortOrder, ...rest }) => rest);

    return this.mapToPublicResponse(page, visaTypes);
  }

  // ============================================================
  // Mappers
  // ============================================================

  private mapToResponse(page: any): CountryPageResponseDto {
    return {
      id: page.id,
      countryId: page.countryId,
      slug: page.slug,
      isActive: page.isActive,
      isPublished: page.isPublished,
      seoTitle: page.seoTitle ?? undefined,
      seoDescription: page.seoDescription ?? undefined,
      country: page.country
        ? {
            id: page.country.id,
            isoCode: page.country.isoCode,
            name: page.country.name,
            flagEmoji: page.country.flagEmoji,
          }
        : undefined,
      sections: page.sections?.map((s: any) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapToPublicResponse(
    page: any,
    visaTypes?: PublicCountryPageResponseDto['visaTypes'],
  ): PublicCountryPageResponseDto {
    return {
      id: page.id,
      slug: page.slug,
      seoTitle: page.seoTitle ?? undefined,
      seoDescription: page.seoDescription ?? undefined,
      country: {
        id: page.country.id,
        isoCode: page.country.isoCode,
        name: page.country.name,
        flagEmoji: page.country.flagEmoji,
      },
      sections: page.sections?.map((s: any) => ({
        id: s.id,
        title: s.title,
        content: s.content,
        sortOrder: s.sortOrder,
        isActive: s.isActive,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      // M11.1 — images and visaTypes only included on the singular
      // public detail (findBySlugPublic). The list endpoint stays
      // lean. Resolve storage keys → public URLs at the boundary so
      // frontend never has to know about provider-specific paths.
      images: page.images?.map((img: any) => ({
        id: img.id,
        imageUrl: this.toPublicUrl(img.imageUrl),
        altText: img.altText ?? undefined,
        displayOrder: img.displayOrder,
      })),
      visaTypes: visaTypes,
    };
  }

  /**
   * Convert a storage key to a browser-fetchable URL. Mirror of the
   * helper used in countryPageImages / homepageSlides services so all
   * public surfaces produce identical URL shapes.
   */
  private toPublicUrl(storageKey: string): string {
    if (/^https?:\/\//i.test(storageKey)) return storageKey;
    const base = this.storageService.getBaseUrl().replace(/\/$/, '');
    return `${base}/${storageKey.replace(/^\/+/, '')}`;
  }
}
