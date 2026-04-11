import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCountrySectionDto, UpdateCountrySectionDto } from './dto';
import { CountrySectionResponseDto } from '../countries/dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class CountrySectionsService {
  private readonly logger = new Logger(CountrySectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new section for a country
   */
  async create(
    countryId: string,
    dto: CreateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    // Verify country exists
    const country = await this.prisma.country.findFirst({
      where: { id: countryId, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Country does not exist or has been deleted',
        },
      ]);
    }

    const section = await this.prisma.countrySection.create({
      data: {
        countryId,
        title: dto.title,
        content: dto.content,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Country section created: ${section.id} for country ${countryId}`);
    return this.mapToResponse(section);
  }

  /**
   * Update a country section
   */
  async update(
    sectionId: string,
    dto: UpdateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    const section = await this.prisma.countrySection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Section not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Country section does not exist or has been deleted',
        },
      ]);
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.content !== undefined) updateData.content = dto.content;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedSection = await this.prisma.countrySection.update({
      where: { id: sectionId },
      data: updateData,
    });

    this.logger.log(`Country section updated: ${sectionId}`);
    return this.mapToResponse(updatedSection);
  }

  /**
   * Soft delete a country section
   */
  async delete(sectionId: string): Promise<void> {
    const section = await this.prisma.countrySection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Section not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Country section does not exist or has been deleted',
        },
      ]);
    }

    await this.prisma.countrySection.update({
      where: { id: sectionId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Country section soft deleted: ${sectionId}`);
  }

  /**
   * Map section entity to response DTO
   */
  private mapToResponse(section: any): CountrySectionResponseDto {
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
