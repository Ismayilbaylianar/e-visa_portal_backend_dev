import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  UpdateCountryDto,
  CountryResponseDto,
  CountryListResponseDto,
  GetCountriesQueryDto,
  PublicCountryResponseDto,
  PublicCountryListResponseDto,
} from './dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * After Module 1.5 split, the Country table holds the immutable UN
 * ISO 3166-1 alpha-2 reference list (250 rows, seeded from
 * prisma/data/countries-iso3166.json). Admin can read + override the
 * small set of display fields (name typo, flag emoji, region label,
 * isActive). Create / Delete are not exposed — reference data is
 * managed exclusively via the seed.
 *
 * Publishable content (slug, SEO, sections) lives on CountryPage and
 * is managed by CountryPagesService.
 */
@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Admin paginated list with continent / hasPage / search filters.
   */
  async findAll(query: GetCountriesQueryDto): Promise<CountryListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.continentCode) {
      where.continentCode = query.continentCode;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { isoCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.hasPage === true) {
      where.page = { isNot: null };
    } else if (query.hasPage === false) {
      where.page = { is: null };
    }

    const [countries, total] = await Promise.all([
      this.prisma.country.findMany({
        where,
        include: { page: { select: { id: true } } },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.country.count({ where }),
    ]);

    const items = countries.map((c) => this.mapToResponse(c));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Admin get one country by id.
   */
  async findById(id: string): Promise<CountryResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
      include: { page: { select: { id: true } } },
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
   * Admin override of reference fields (typo fix on name, flag swap,
   * region relabel, deactivate). Audit entry on every save.
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

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.flagEmoji !== undefined) updateData.flagEmoji = dto.flagEmoji;
    if (dto.continentCode !== undefined) updateData.continentCode = dto.continentCode;
    if (dto.region !== undefined) updateData.region = dto.region;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedCountry = await this.prisma.country.update({
      where: { id },
      data: updateData,
      include: { page: { select: { id: true } } },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'country.update',
        'Country',
        id,
        {
          name: country.name,
          flagEmoji: country.flagEmoji,
          continentCode: country.continentCode,
          region: country.region,
          isActive: country.isActive,
        },
        {
          name: updatedCountry.name,
          flagEmoji: updatedCountry.flagEmoji,
          continentCode: updatedCountry.continentCode,
          region: updatedCountry.region,
          isActive: updatedCountry.isActive,
        },
      );
    }

    this.logger.log(`Country updated: ${id}`);
    return this.mapToResponse(updatedCountry);
  }

  /**
   * Public list of all reference countries (used by selection dropdowns,
   * paired with smart filter against TemplateBindings in Sprint 4 / UX-001).
   */
  async findAllPublic(): Promise<PublicCountryListResponseDto> {
    const countries = await this.prisma.country.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });

    const items = countries.map((c) => this.mapToPublicResponse(c));
    return { items, total: items.length };
  }

  /**
   * Map country row → admin response.
   */
  private mapToResponse(country: any): CountryResponseDto {
    return {
      id: country.id,
      isoCode: country.isoCode,
      name: country.name,
      flagEmoji: country.flagEmoji,
      continentCode: country.continentCode,
      region: country.region,
      isActive: country.isActive,
      hasPage: !!country.page,
      createdAt: country.createdAt,
      updatedAt: country.updatedAt,
    };
  }

  /**
   * Map country row → public minimal response.
   */
  private mapToPublicResponse(country: any): PublicCountryResponseDto {
    return {
      id: country.id,
      isoCode: country.isoCode,
      name: country.name,
      flagEmoji: country.flagEmoji,
      continentCode: country.continentCode,
    };
  }
}
