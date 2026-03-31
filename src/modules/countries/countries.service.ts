import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  CountryResponseDto,
  PublicCountryResponseDto,
  GetCountriesQueryDto,
  GetPublicCountriesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class CountriesService {
  private readonly logger = new Logger(CountriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetCountriesQueryDto,
  ): Promise<{ items: CountryResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.isPublished !== undefined && { isPublished: query.isPublished }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
          { isoCode: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

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
      throw new NotFoundException('Country not found');
    }

    return this.mapToResponse(country);
  }

  async findBySlug(slug: string): Promise<PublicCountryResponseDto> {
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
      throw new NotFoundException('Country not found');
    }

    return this.mapToPublicResponse(country);
  }

  async findAllPublic(
    query: GetPublicCountriesQueryDto,
  ): Promise<{ items: PublicCountryResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      isActive: true,
      isPublished: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { isoCode: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [countries, total] = await Promise.all([
      this.prisma.country.findMany({
        where,
        include: {
          sections: {
            where: { deletedAt: null, isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.country.count({ where }),
    ]);

    const items = countries.map(country => this.mapToPublicResponse(country));

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async create(dto: CreateCountryDto): Promise<CountryResponseDto> {
    const existingBySlug = await this.prisma.country.findUnique({
      where: { slug: dto.slug },
    });

    if (existingBySlug) {
      throw new ConflictException('Country with this slug already exists');
    }

    const existingByIsoCode = await this.prisma.country.findUnique({
      where: { isoCode: dto.isoCode },
    });

    if (existingByIsoCode) {
      throw new ConflictException('Country with this ISO code already exists');
    }

    const country = await this.prisma.country.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        isoCode: dto.isoCode,
        isActive: dto.isActive ?? true,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        isPublished: dto.isPublished ?? false,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    this.logger.log(`Country created: ${country.id}`);
    return this.mapToResponse(country);
  }

  async update(id: string, dto: UpdateCountryDto): Promise<CountryResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    if (dto.slug && dto.slug !== country.slug) {
      const existingBySlug = await this.prisma.country.findUnique({
        where: { slug: dto.slug },
      });
      if (existingBySlug) {
        throw new ConflictException('Country with this slug already exists');
      }
    }

    if (dto.isoCode && dto.isoCode !== country.isoCode) {
      const existingByIsoCode = await this.prisma.country.findUnique({
        where: { isoCode: dto.isoCode },
      });
      if (existingByIsoCode) {
        throw new ConflictException('Country with this ISO code already exists');
      }
    }

    const updatedCountry = await this.prisma.country.update({
      where: { id },
      data: dto,
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    this.logger.log(`Country updated: ${id}`);
    return this.mapToResponse(updatedCountry);
  }

  async delete(id: string): Promise<void> {
    const country = await this.prisma.country.findFirst({
      where: { id, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found');
    }

    await this.prisma.country.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Country deleted: ${id}`);
  }

  private mapToResponse(country: any): CountryResponseDto {
    return {
      id: country.id,
      name: country.name,
      slug: country.slug,
      isoCode: country.isoCode,
      isActive: country.isActive,
      seoTitle: country.seoTitle || undefined,
      seoDescription: country.seoDescription || undefined,
      isPublished: country.isPublished,
      sections: country.sections?.map((section: any) => ({
        id: section.id,
        title: section.title,
        content: section.content,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      })),
      createdAt: country.createdAt,
      updatedAt: country.updatedAt,
    };
  }

  private mapToPublicResponse(country: any): PublicCountryResponseDto {
    return {
      id: country.id,
      name: country.name,
      slug: country.slug,
      isoCode: country.isoCode,
      seoTitle: country.seoTitle || undefined,
      seoDescription: country.seoDescription || undefined,
      sections: country.sections?.map((section: any) => ({
        id: section.id,
        title: section.title,
        content: section.content,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      })),
    };
  }
}
