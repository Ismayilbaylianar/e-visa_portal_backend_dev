import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  TemplateListItemResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of templates (summary view without deeply nested data)
   */
  async findAll(
    query: GetTemplatesQueryDto,
  ): Promise<{ items: TemplateListItemResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { key: { contains: search, mode: 'insensitive' as const } },
          { description: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        include: {
          _count: {
            select: {
              sections: {
                where: { deletedAt: null },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.template.count({ where }),
    ]);

    const items = templates.map(template => this.mapToListItemResponse(template));

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

  /**
   * Get template by ID with full nested structure (sections and fields)
   */
  async findById(id: string): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(template);
  }

  /**
   * Create a new template
   */
  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    const existingByKey = await this.prisma.template.findUnique({
      where: { key: dto.key },
    });

    if (existingByKey) {
      throw new ConflictException('Template key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A template with this key already exists',
        },
      ]);
    }

    const template = await this.prisma.template.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        version: 1,
        isActive: dto.isActive ?? true,
      },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    this.logger.log(`Template created: ${template.id} (${template.key})`);
    return this.mapToResponse(template);
  }

  /**
   * Update template
   * Note: Version is not auto-incremented in this stage. Manual version management if needed.
   */
  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    if (dto.key && dto.key !== template.key) {
      const existingByKey = await this.prisma.template.findUnique({
        where: { key: dto.key },
      });
      if (existingByKey) {
        throw new ConflictException('Template key already exists', [
          {
            field: 'key',
            reason: ErrorCodes.CONFLICT,
            message: 'A template with this key already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.key !== undefined) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedTemplate = await this.prisma.template.update({
      where: { id },
      data: updateData,
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            fields: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });

    this.logger.log(`Template updated: ${id}`);
    return this.mapToResponse(updatedTemplate);
  }

  /**
   * Soft delete template and all its sections and fields
   */
  async delete(id: string): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    const now = new Date();
    const sectionIds = template.sections.map(s => s.id);

    await this.prisma.$transaction([
      // Soft delete all fields in all sections
      ...(sectionIds.length > 0
        ? [
            this.prisma.templateField.updateMany({
              where: { templateSectionId: { in: sectionIds }, deletedAt: null },
              data: { deletedAt: now },
            }),
          ]
        : []),
      // Soft delete all sections
      this.prisma.templateSection.updateMany({
        where: { templateId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Soft delete template
      this.prisma.template.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    this.logger.log(`Template soft deleted: ${id} (with ${sectionIds.length} sections)`);
  }

  /**
   * Map template to list item response (summary without nested data)
   */
  private mapToListItemResponse(template: any): TemplateListItemResponseDto {
    return {
      id: template.id,
      name: template.name,
      key: template.key,
      description: template.description || undefined,
      version: template.version,
      isActive: template.isActive,
      sectionsCount: template._count?.sections ?? 0,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Map template to full response with nested sections and fields
   */
  private mapToResponse(template: any): TemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      key: template.key,
      description: template.description || undefined,
      version: template.version,
      isActive: template.isActive,
      sections: template.sections?.map((section: any) => ({
        id: section.id,
        title: section.title,
        key: section.key,
        description: section.description || undefined,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
        fields: section.fields?.map((field: any) => ({
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
        })),
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
      })),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
