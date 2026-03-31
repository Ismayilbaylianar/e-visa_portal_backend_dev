import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateCountrySectionDto,
  UpdateCountrySectionDto,
  CountrySectionResponseDto,
} from './dto';
import { NotFoundException } from '@/common/exceptions';

@Injectable()
export class CountrySectionsService {
  private readonly logger = new Logger(CountrySectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    countryId: string,
    dto: CreateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    const country = await this.prisma.country.findFirst({
      where: { id: countryId, deletedAt: null },
    });

    if (!country) {
      throw new NotFoundException('Country not found');
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

    this.logger.log(`Country section created: ${section.id} for country: ${countryId}`);
    return this.mapToResponse(section);
  }

  async update(
    sectionId: string,
    dto: UpdateCountrySectionDto,
  ): Promise<CountrySectionResponseDto> {
    const section = await this.prisma.countrySection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Country section not found');
    }

    const updatedSection = await this.prisma.countrySection.update({
      where: { id: sectionId },
      data: dto,
    });

    this.logger.log(`Country section updated: ${sectionId}`);
    return this.mapToResponse(updatedSection);
  }

  async delete(sectionId: string): Promise<void> {
    const section = await this.prisma.countrySection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Country section not found');
    }

    await this.prisma.countrySection.update({
      where: { id: sectionId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Country section deleted: ${sectionId}`);
  }

  private mapToResponse(section: any): CountrySectionResponseDto {
    return {
      id: section.id,
      countryId: section.countryId,
      title: section.title,
      content: section.content,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
