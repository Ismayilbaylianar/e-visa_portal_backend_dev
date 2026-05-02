import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateTemplateSectionDto,
  UpdateTemplateSectionDto,
  TemplateSectionResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class TemplateSectionsService {
  private readonly logger = new Logger(TemplateSectionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Create a new section under a template
   */
  async create(
    templateId: string,
    dto: CreateTemplateSectionDto,
    actorUserId?: string,
  ): Promise<TemplateSectionResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    const existingSection = await this.prisma.templateSection.findFirst({
      where: {
        templateId,
        key: dto.key,
        deletedAt: null,
      },
    });

    if (existingSection) {
      throw new ConflictException('Section key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A section with this key already exists in the template',
        },
      ]);
    }

    const section = await this.prisma.templateSection.create({
      data: {
        templateId,
        title: dto.title,
        key: dto.key,
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        fields: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.section.create',
        'TemplateSection',
        section.id,
        undefined,
        {
          templateId,
          key: section.key,
          title: section.title,
          sortOrder: section.sortOrder,
        },
      );
    }

    this.logger.log(
      `Template section created: ${section.id} (${section.key}) for template: ${templateId}`,
    );
    return this.mapToResponse(section);
  }

  /**
   * Update template section
   */
  async update(
    sectionId: string,
    dto: UpdateTemplateSectionDto,
    actorUserId?: string,
  ): Promise<TemplateSectionResponseDto> {
    const section = await this.prisma.templateSection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Template section not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Template section does not exist or has been deleted',
        },
      ]);
    }

    if (dto.key && dto.key !== section.key) {
      const existingSection = await this.prisma.templateSection.findFirst({
        where: {
          templateId: section.templateId,
          key: dto.key,
          deletedAt: null,
          id: { not: sectionId },
        },
      });

      if (existingSection) {
        throw new ConflictException('Section key already exists', [
          {
            field: 'key',
            reason: ErrorCodes.CONFLICT,
            message: 'A section with this key already exists in the template',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.key !== undefined) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedSection = await this.prisma.templateSection.update({
      where: { id: sectionId },
      data: updateData,
      include: {
        fields: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.section.update',
        'TemplateSection',
        sectionId,
        { title: section.title, key: section.key, description: section.description, isActive: section.isActive },
        {
          title: updatedSection.title,
          key: updatedSection.key,
          description: updatedSection.description,
          isActive: updatedSection.isActive,
        },
      );
    }

    this.logger.log(`Template section updated: ${sectionId}`);
    return this.mapToResponse(updatedSection);
  }

  /**
   * Soft delete template section and all its fields
   */
  async delete(sectionId: string, actorUserId?: string): Promise<void> {
    const section = await this.prisma.templateSection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Template section not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Template section does not exist or has been deleted',
        },
      ]);
    }

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.templateField.updateMany({
        where: { templateSectionId: sectionId, deletedAt: null },
        data: { deletedAt: now },
      }),
      this.prisma.templateSection.update({
        where: { id: sectionId },
        data: { deletedAt: now },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.section.delete',
        'TemplateSection',
        sectionId,
        { templateId: section.templateId, title: section.title, key: section.key },
        undefined,
      );
    }

    this.logger.log(`Template section soft deleted: ${sectionId}`);
  }

  private mapToResponse(section: any): TemplateSectionResponseDto {
    return {
      id: section.id,
      templateId: section.templateId,
      title: section.title,
      key: section.key,
      description: section.description || undefined,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      fields:
        section.fields?.map((field: any) => ({
          id: field.id,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          label: field.label,
          placeholder: field.placeholder || undefined,
          helpText: field.helpText || undefined,
          defaultValue: field.defaultValue || undefined,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
          isActive: field.isActive,
          optionsJson: field.optionsJson ?? [],
          validationRulesJson: field.validationRulesJson ?? null,
          visibilityRulesJson: field.visibilityRulesJson ?? [],
          createdAt: field.createdAt,
          updatedAt: field.updatedAt,
        })) ?? [],
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
    };
  }
}
