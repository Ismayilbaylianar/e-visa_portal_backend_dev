import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
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

/**
 * Template Builder service.
 *
 * Audit: every mutation emits a `template.{create,update,delete,duplicate}`
 * lowercase.dot key (Module 6a convention). Section + field reordering
 * emits `template.section.reorder` / `template.field.reorder` from
 * separate services — kept here only for the template-level lifecycle.
 *
 * `duplicate()` deep-clones a template plus all sections + fields in a
 * single transaction so partial failures (e.g. duplicate key on the
 * second section) roll back the whole tree.
 */
@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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
      ...(query.isBoilerplate !== undefined && { isBoilerplate: query.isBoilerplate }),
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
  async create(dto: CreateTemplateDto, actorUserId?: string): Promise<TemplateResponseDto> {
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.create',
        'Template',
        template.id,
        undefined,
        { key: template.key, name: template.name, version: template.version, isActive: template.isActive },
      );
    }

    this.logger.log(`Template created: ${template.id} (${template.key})`);
    return this.mapToResponse(template);
  }

  /**
   * Duplicate a template — deep clones the template, all its sections,
   * and all their fields in a single transaction. The new template
   * starts at version 1 (independent lifecycle from the source).
   *
   * Bindings, applications, and audit history are NOT copied —
   * duplicates are content-only.
   */
  async duplicate(
    sourceId: string,
    dto: { name: string; key: string; description?: string },
    actorUserId?: string,
  ): Promise<TemplateResponseDto> {
    const source = await this.prisma.template.findFirst({
      where: { id: sourceId, deletedAt: null },
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

    if (!source) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Source template does not exist' },
      ]);
    }

    const existingByKey = await this.prisma.template.findUnique({ where: { key: dto.key } });
    if (existingByKey) {
      throw new ConflictException('Template key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A template with this key already exists',
        },
      ]);
    }

    // Single transaction: create template → fan out sections → fan out
    // fields per section. Any partial failure rolls back the entire tree.
    const newTemplate = await this.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          name: dto.name,
          key: dto.key,
          description: dto.description ?? source.description,
          version: 1,
          isActive: true,
        },
      });

      for (const section of source.sections) {
        const newSection = await tx.templateSection.create({
          data: {
            templateId: created.id,
            title: section.title,
            key: section.key,
            description: section.description,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
        });

        if (section.fields.length > 0) {
          await tx.templateField.createMany({
            data: section.fields.map((f) => ({
              templateSectionId: newSection.id,
              fieldKey: f.fieldKey,
              fieldType: f.fieldType,
              label: f.label,
              placeholder: f.placeholder,
              helpText: f.helpText,
              defaultValue: f.defaultValue,
              isRequired: f.isRequired,
              sortOrder: f.sortOrder,
              isActive: f.isActive,
              optionsJson: f.optionsJson ?? undefined,
              validationRulesJson: f.validationRulesJson ?? undefined,
              visibilityRulesJson: f.visibilityRulesJson ?? undefined,
            })),
          });
        }
      }

      return created;
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.duplicate',
        'Template',
        newTemplate.id,
        { sourceId: source.id, sourceKey: source.key },
        { newId: newTemplate.id, newKey: newTemplate.key, name: newTemplate.name },
      );
    }

    this.logger.log(`Template duplicated: ${source.id} → ${newTemplate.id} (${newTemplate.key})`);
    return this.findById(newTemplate.id);
  }

  /**
   * Update template
   * Note: Version is not auto-incremented in this stage. Manual version management if needed.
   */
  async update(
    id: string,
    dto: UpdateTemplateDto,
    actorUserId?: string,
  ): Promise<TemplateResponseDto> {
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.update',
        'Template',
        id,
        { name: template.name, key: template.key, description: template.description, isActive: template.isActive },
        {
          name: updatedTemplate.name,
          key: updatedTemplate.key,
          description: updatedTemplate.description,
          isActive: updatedTemplate.isActive,
        },
      );
    }

    this.logger.log(`Template updated: ${id}`);
    return this.mapToResponse(updatedTemplate);
  }

  /**
   * Soft delete template and all its sections and fields
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.delete',
        'Template',
        id,
        {
          key: template.key,
          name: template.name,
          version: template.version,
          sectionCount: sectionIds.length,
        },
        undefined,
      );
    }

    this.logger.log(`Template soft deleted: ${id} (with ${sectionIds.length} sections)`);
  }

  /**
   * Section reorder — bulk update sortOrder for sections under one
   * template in a single transaction. Validates that every id belongs
   * to the template before applying changes.
   */
  async reorderSections(
    templateId: string,
    orderedIds: string[],
    actorUserId?: string,
  ): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
      include: {
        sections: { where: { deletedAt: null }, select: { id: true } },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Template does not exist' },
      ]);
    }

    const knownIds = new Set(template.sections.map((s) => s.id));
    const unknown = orderedIds.filter((id) => !knownIds.has(id));
    if (unknown.length > 0) {
      throw new ConflictException('Reorder rejected', [
        {
          field: 'orderedIds',
          reason: ErrorCodes.CONFLICT,
          message: `Sections do not belong to this template: ${unknown.join(', ')}`,
        },
      ]);
    }

    if (orderedIds.length !== template.sections.length) {
      throw new ConflictException('Reorder rejected', [
        {
          field: 'orderedIds',
          reason: ErrorCodes.CONFLICT,
          message: `Expected ${template.sections.length} section ids, received ${orderedIds.length}`,
        },
      ]);
    }

    const beforeOrder = template.sections.map((s) => s.id);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.templateSection.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.section.reorder',
        'Template',
        templateId,
        { order: beforeOrder },
        { order: orderedIds },
      );
    }

    this.logger.log(`Template sections reordered: ${templateId} (${orderedIds.length} sections)`);
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
      isBoilerplate: template.isBoilerplate ?? false,
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
      isBoilerplate: template.isBoilerplate ?? false,
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
