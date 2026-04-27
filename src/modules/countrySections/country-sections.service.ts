import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { CreateCountrySectionDto, UpdateCountrySectionDto } from './dto';
import { CountrySectionResponseDto } from '../countries/dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * Module 1.5 update: CountrySection now FKs to CountryPage instead of
 * Country. The DTO shape is unchanged; only the parent identifier and
 * the parent existence check moved.
 */
@Injectable()
export class CountrySectionsService {
  private readonly logger = new Logger(CountrySectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async create(
    countryPageId: string,
    dto: CreateCountrySectionDto,
    actorUserId?: string,
  ): Promise<CountrySectionResponseDto> {
    const page = await this.prisma.countryPage.findFirst({
      where: { id: countryPageId, deletedAt: null },
    });

    if (!page) {
      throw new NotFoundException('CountryPage not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'CountryPage does not exist or has been deleted',
        },
      ]);
    }

    const section = await this.prisma.countrySection.create({
      data: {
        countryPageId,
        title: dto.title,
        content: dto.content,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countrySection.create',
        'CountrySection',
        section.id,
        undefined,
        {
          countryPageId,
          title: section.title,
          sortOrder: section.sortOrder,
          isActive: section.isActive,
        },
      );
    }

    this.logger.log(`Country section created: ${section.id} for page ${countryPageId}`);
    return this.mapToResponse(section);
  }

  async update(
    sectionId: string,
    dto: UpdateCountrySectionDto,
    actorUserId?: string,
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countrySection.update',
        'CountrySection',
        sectionId,
        {
          title: section.title,
          sortOrder: section.sortOrder,
          isActive: section.isActive,
        },
        {
          title: updatedSection.title,
          sortOrder: updatedSection.sortOrder,
          isActive: updatedSection.isActive,
        },
      );
    }

    this.logger.log(`Country section updated: ${sectionId}`);
    return this.mapToResponse(updatedSection);
  }

  async delete(sectionId: string, actorUserId?: string): Promise<void> {
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'countrySection.delete',
        'CountrySection',
        sectionId,
        {
          countryPageId: section.countryPageId,
          title: section.title,
          sortOrder: section.sortOrder,
        },
        undefined,
      );
    }

    this.logger.log(`Country section soft deleted: ${sectionId}`);
  }

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
