import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
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
      },
    });

    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Page does not exist or is not published' },
      ]);
    }

    return this.mapToPublicResponse(page);
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

  private mapToPublicResponse(page: any): PublicCountryPageResponseDto {
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
    };
  }
}
