import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { CreateTemplateFieldDto, UpdateTemplateFieldDto, TemplateFieldResponseDto } from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class TemplateFieldsService {
  private readonly logger = new Logger(TemplateFieldsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Create a new field under a template section
   * fieldKey uniqueness is enforced at the TEMPLATE level (across all sections)
   * This is the future-safe option for form data handling where field keys map to form values
   */
  async create(
    sectionId: string,
    dto: CreateTemplateFieldDto,
    actorUserId?: string,
  ): Promise<TemplateFieldResponseDto> {
    const section = await this.prisma.templateSection.findFirst({
      where: { id: sectionId, deletedAt: null },
      include: { template: true },
    });

    if (!section) {
      throw new NotFoundException('Template section not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Template section does not exist or has been deleted',
        },
      ]);
    }

    // Check fieldKey uniqueness at TEMPLATE level (across all sections)
    const existingField = await this.prisma.templateField.findFirst({
      where: {
        templateSection: {
          templateId: section.templateId,
          deletedAt: null,
        },
        fieldKey: dto.fieldKey,
        deletedAt: null,
      },
    });

    if (existingField) {
      throw new ConflictException('Field key already exists in template', [
        {
          field: 'fieldKey',
          reason: ErrorCodes.CONFLICT,
          message:
            'A field with this key already exists in the template. Field keys must be unique across all sections within a template.',
        },
      ]);
    }

    const field = await this.prisma.templateField.create({
      data: {
        templateSectionId: sectionId,
        fieldKey: dto.fieldKey,
        fieldType: dto.fieldType,
        label: dto.label,
        placeholder: dto.placeholder,
        helpText: dto.helpText,
        defaultValue: dto.defaultValue,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        optionsJson: dto.optionsJson ?? [],
        validationRulesJson: dto.validationRulesJson ?? undefined,
        visibilityRulesJson: dto.visibilityRulesJson ?? [],
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.field.create',
        'TemplateField',
        field.id,
        undefined,
        {
          templateSectionId: sectionId,
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          label: field.label,
          isRequired: field.isRequired,
          sortOrder: field.sortOrder,
        },
      );
    }

    this.logger.log(
      `Template field created: ${field.id} (${field.fieldKey}) in section: ${sectionId}`,
    );
    return this.mapToResponse(field);
  }

  /**
   * Update template field
   * fieldKey uniqueness is enforced at the TEMPLATE level
   */
  async update(
    fieldId: string,
    dto: UpdateTemplateFieldDto,
    actorUserId?: string,
  ): Promise<TemplateFieldResponseDto> {
    const field = await this.prisma.templateField.findFirst({
      where: { id: fieldId, deletedAt: null },
      include: {
        templateSection: true,
      },
    });

    if (!field) {
      throw new NotFoundException('Template field not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Template field does not exist or has been deleted',
        },
      ]);
    }

    // Check fieldKey uniqueness at TEMPLATE level if changing
    if (dto.fieldKey && dto.fieldKey !== field.fieldKey) {
      const existingField = await this.prisma.templateField.findFirst({
        where: {
          templateSection: {
            templateId: field.templateSection.templateId,
            deletedAt: null,
          },
          fieldKey: dto.fieldKey,
          deletedAt: null,
          id: { not: fieldId },
        },
      });

      if (existingField) {
        throw new ConflictException('Field key already exists in template', [
          {
            field: 'fieldKey',
            reason: ErrorCodes.CONFLICT,
            message:
              'A field with this key already exists in the template. Field keys must be unique across all sections within a template.',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.fieldKey !== undefined) updateData.fieldKey = dto.fieldKey;
    if (dto.fieldType !== undefined) updateData.fieldType = dto.fieldType;
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.placeholder !== undefined) updateData.placeholder = dto.placeholder;
    if (dto.helpText !== undefined) updateData.helpText = dto.helpText;
    if (dto.defaultValue !== undefined) updateData.defaultValue = dto.defaultValue;
    if (dto.isRequired !== undefined) updateData.isRequired = dto.isRequired;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.optionsJson !== undefined) updateData.optionsJson = dto.optionsJson;
    if (dto.validationRulesJson !== undefined)
      updateData.validationRulesJson = dto.validationRulesJson;
    if (dto.visibilityRulesJson !== undefined)
      updateData.visibilityRulesJson = dto.visibilityRulesJson;

    const updatedField = await this.prisma.templateField.update({
      where: { id: fieldId },
      data: updateData,
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.field.update',
        'TemplateField',
        fieldId,
        {
          fieldKey: field.fieldKey,
          fieldType: field.fieldType,
          label: field.label,
          isRequired: field.isRequired,
        },
        {
          fieldKey: updatedField.fieldKey,
          fieldType: updatedField.fieldType,
          label: updatedField.label,
          isRequired: updatedField.isRequired,
        },
      );
    }

    this.logger.log(`Template field updated: ${fieldId}`);
    return this.mapToResponse(updatedField);
  }

  /**
   * Soft delete template field
   */
  async delete(fieldId: string, actorUserId?: string): Promise<void> {
    const field = await this.prisma.templateField.findFirst({
      where: { id: fieldId, deletedAt: null },
    });

    if (!field) {
      throw new NotFoundException('Template field not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Template field does not exist or has been deleted',
        },
      ]);
    }

    await this.prisma.templateField.update({
      where: { id: fieldId },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.field.delete',
        'TemplateField',
        fieldId,
        { templateSectionId: field.templateSectionId, fieldKey: field.fieldKey, label: field.label },
        undefined,
      );
    }

    this.logger.log(`Template field soft deleted: ${fieldId}`);
  }

  /**
   * Reorder fields within a section, OR move + reorder fields across
   * sections in a single transaction. Each item carries its target
   * sectionId — for in-place reorder, all items share the same
   * sectionId; for a cross-section move, the moved field's item points
   * to the new sectionId.
   *
   * Validates that every targeted section belongs to the same template
   * (cross-template moves are blocked — would let admin accidentally
   * mingle visa form structures).
   */
  async reorderFields(
    rootSectionId: string,
    items: Array<{ id: string; sectionId: string; sortOrder: number }>,
    actorUserId?: string,
  ): Promise<void> {
    if (items.length === 0) return;

    const rootSection = await this.prisma.templateSection.findFirst({
      where: { id: rootSectionId, deletedAt: null },
      select: { id: true, templateId: true },
    });
    if (!rootSection) {
      throw new NotFoundException('Section not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Source section does not exist' },
      ]);
    }

    // Resolve every targeted field + section in one round trip; check
    // they all belong to the same template as the root section.
    const targetSectionIds = Array.from(new Set(items.map((i) => i.sectionId)));
    const targetSections = await this.prisma.templateSection.findMany({
      where: { id: { in: targetSectionIds }, deletedAt: null },
      select: { id: true, templateId: true },
    });
    const foreign = targetSections.filter((s) => s.templateId !== rootSection.templateId);
    if (foreign.length > 0) {
      throw new ConflictException('Cross-template moves not allowed', [
        {
          field: 'sectionId',
          reason: ErrorCodes.CONFLICT,
          message: 'All target sections must belong to the same template as the source',
        },
      ]);
    }
    if (targetSections.length !== targetSectionIds.length) {
      throw new NotFoundException('Target section not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'One or more target sections do not exist' },
      ]);
    }

    const fieldIds = items.map((i) => i.id);
    const fields = await this.prisma.templateField.findMany({
      where: { id: { in: fieldIds }, deletedAt: null },
      select: { id: true, templateSectionId: true, fieldKey: true },
    });
    if (fields.length !== fieldIds.length) {
      throw new NotFoundException('Field not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'One or more fields do not exist' },
      ]);
    }

    // Atomic apply: each item updates sortOrder + (potentially) the
    // section linkage. fieldKey uniqueness within a template is
    // preserved because cross-template moves are blocked above and
    // existing keys round-trip unchanged.
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.templateField.update({
          where: { id: item.id },
          data: {
            templateSectionId: item.sectionId,
            sortOrder: item.sortOrder,
          },
        }),
      ),
    );

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.field.reorder',
        'TemplateSection',
        rootSectionId,
        { fields: fields.map((f) => ({ id: f.id, fieldKey: f.fieldKey, sectionId: f.templateSectionId })) },
        { fields: items },
      );
    }

    this.logger.log(`Template fields reordered under section ${rootSectionId}: ${items.length} items`);
  }

  private mapToResponse(field: any): TemplateFieldResponseDto {
    return {
      id: field.id,
      templateSectionId: field.templateSectionId,
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
    };
  }
}
