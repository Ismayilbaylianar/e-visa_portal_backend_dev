import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  CountryResponseDto,
  CountryListResponseDto,
  GetCountriesQueryDto,
  PublicCountryResponseDto,
  PublicCountryListResponseDto,
  CountrySectionResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Get paginated list of countries (admin)
   */
  async findAll(query: GetCountriesQueryDto): Promise<CountryListResponseDto> {
    const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { isoCode: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [countries, total] = await Promise.all([
      this.prisma.country.findMany({
        where,
        include: {
          sections: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.country.count({ where }),
    ]);

    const items = countries.map(country => this.mapToResponse(country));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get country by ID (admin)
   */
  async findById(id: string): Promise<CountryResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Country does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(country);
  }

  /**
   * Create new country
   */
  async create(dto: CreateCountryDto, actorUserId?: string): Promise<CountryResponseDto> {
    // Check slug uniqueness
    const existingBySlug = await this.prisma.country.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException('Slug already exists', [
        {
          field: 'slug',
          reason: ErrorCodes.CONFLICT,
          message: 'A country with this slug already exists',
        },
      ]);
    }

    // Check ISO code uniqueness
    const existingByIso = await this.prisma.country.findUnique({
      where: { isoCode: dto.isoCode },
    });

    if (existingByIso) {
      throw new ConflictException('ISO code already exists', [
        {
          field: 'isoCode',
          reason: ErrorCodes.CONFLICT,
          message: 'A country with this ISO code already exists',
        },
      ]);
    }

    const country = await this.prisma.country.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        isoCode: dto.isoCode,
        isActive: dto.isActive ?? true,
        isPublished: dto.isPublished ?? false,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'country.create',
        'Country',
        country.id,
        undefined,
        {
          name: country.name,
          slug: country.slug,
          isoCode: country.isoCode,
          isActive: country.isActive,
          isPublished: country.isPublished,
          seoTitle: country.seoTitle,
          seoDescription: country.seoDescription,
        },
      );
    }

    this.logger.log(`Country created: ${country.id} (${country.name})`);
    return this.mapToResponse(country);
  }

  /**
   * Update country
   */
  async update(
    id: string,
    dto: UpdateCountryDto,
    actorUserId?: string,
  ): Promise<CountryResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Country does not exist or has been deleted',
        },
      ]);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== country.slug) {
      const existingBySlug = await this.prisma.country.findUnique({
        where: { slug: dto.slug },
      });
      if (existingBySlug) {
        throw new ConflictException('Slug already exists', [
          {
            field: 'slug',
            reason: ErrorCodes.CONFLICT,
            message: 'A country with this slug already exists',
          },
        ]);
      }
    }

    // Check ISO code uniqueness if changing
    if (dto.isoCode && dto.isoCode !== country.isoCode) {
      const existingByIso = await this.prisma.country.findUnique({
        where: { isoCode: dto.isoCode },
      });
      if (existingByIso) {
        throw new ConflictException('ISO code already exists', [
          {
            field: 'isoCode',
            reason: ErrorCodes.CONFLICT,
            message: 'A country with this ISO code already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.slug !== undefined) updateData.slug = dto.slug;
    if (dto.isoCode !== undefined) updateData.isoCode = dto.isoCode;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.isPublished !== undefined) updateData.isPublished = dto.isPublished;
    if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) updateData.seoDescription = dto.seoDescription;

    const updatedCountry = await this.prisma.country.update({
      where: { id },
      data: updateData,
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'country.update',
        'Country',
        id,
        {
          name: country.name,
          slug: country.slug,
          isoCode: country.isoCode,
          isActive: country.isActive,
          isPublished: country.isPublished,
          seoTitle: country.seoTitle,
          seoDescription: country.seoDescription,
        },
        {
          name: updatedCountry.name,
          slug: updatedCountry.slug,
          isoCode: updatedCountry.isoCode,
          isActive: updatedCountry.isActive,
          isPublished: updatedCountry.isPublished,
          seoTitle: updatedCountry.seoTitle,
          seoDescription: updatedCountry.seoDescription,
        },
      );
    }

    this.logger.log(`Country updated: ${id}`);
    return this.mapToResponse(updatedCountry);
  }

  /**
   * Soft delete country
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Country does not exist or has been deleted',
        },
      ]);
    }

    // Block deletion if country is referenced by any active TemplateBinding
    // (as destinationCountryId) or BindingNationalityFee (as nationalityCountryId).
    // Soft-deleted bindings/fees are ignored.
    const [bindingCount, feeCount] = await Promise.all([
      this.prisma.templateBinding.count({
        where: {
          destinationCountryId: id,
          deletedAt: null,
          isActive: true,
        },
      }),
      this.prisma.bindingNationalityFee.count({
        where: {
          nationalityCountryId: id,
          deletedAt: null,
          isActive: true,
        },
      }),
    ]);

    if (bindingCount > 0 || feeCount > 0) {
      const details = [];
      if (bindingCount > 0) {
        details.push({
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `Country is in use as destination by ${bindingCount} active binding(s)`,
        });
      }
      if (feeCount > 0) {
        details.push({
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `Country is in use as nationality in ${feeCount} fee record(s)`,
        });
      }
      throw new ConflictException('Country is in use', details);
    }

    // Soft delete country and its sections
    await this.prisma.$transaction([
      this.prisma.country.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.countrySection.updateMany({
        where: { countryId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'country.delete',
        'Country',
        id,
        {
          name: country.name,
          slug: country.slug,
          isoCode: country.isoCode,
          isActive: country.isActive,
          isPublished: country.isPublished,
        },
        undefined,
      );
    }

    this.logger.log(`Country soft deleted: ${id}`);
  }

  /**
   * Get public list of countries (published + active only)
   */
  async findAllPublic(): Promise<PublicCountryListResponseDto> {
    const countries = await this.prisma.country.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        isPublished: true,
      },
      include: {
        sections: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const items = countries.map(country => this.mapToPublicResponse(country));

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Get public country by slug
   */
  async findBySlugPublic(slug: string): Promise<PublicCountryResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: {
        slug,
        deletedAt: null,
        isActive: true,
        isPublished: true,
      },
      include: {
        sections: {
          where: { deletedAt: null, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Country does not exist or is not available',
        },
      ]);
    }

    return this.mapToPublicResponse(country);
  }

  /**
   * Map country entity to admin response DTO
   */
  private mapToResponse(country: any): CountryResponseDto {
    return {
      id: country.id,
      name: country.name,
      slug: country.slug,
      isoCode: country.isoCode,
      isActive: country.isActive,
      isPublished: country.isPublished,
      seoTitle: country.seoTitle || undefined,
      seoDescription: country.seoDescription || undefined,
      sections: country.sections?.map((s: any) => this.mapSectionToResponse(s)),
      createdAt: country.createdAt,
      updatedAt: country.updatedAt,
    };
  }

  /**
   * Map country entity to public response DTO
   */
  private mapToPublicResponse(country: any): PublicCountryResponseDto {
    return {
      id: country.id,
      name: country.name,
      slug: country.slug,
      isoCode: country.isoCode,
      seoTitle: country.seoTitle || undefined,
      seoDescription: country.seoDescription || undefined,
      sections: country.sections?.map((s: any) => this.mapSectionToResponse(s)),
    };
  }

  /**
   * Map section entity to response DTO
   */
  private mapSectionToResponse(section: any): CountrySectionResponseDto {
    return {
      id: section.id,
      title: section.title,
      content: section.content,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
