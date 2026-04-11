import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateFieldDto, UpdateTemplateFieldDto, TemplateFieldResponseDto } from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class TemplateFieldsService {
  private readonly logger = new Logger(TemplateFieldsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new field under a template section
   * fieldKey uniqueness is enforced at the TEMPLATE level (across all sections)
   * This is the future-safe option for form data handling where field keys map to form values
   */
  async create(sectionId: string, dto: CreateTemplateFieldDto): Promise<TemplateFieldResponseDto> {
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

    this.logger.log(
      `Template field created: ${field.id} (${field.fieldKey}) in section: ${sectionId}`,
    );
    return this.mapToResponse(field);
  }

  /**
   * Update template field
   * fieldKey uniqueness is enforced at the TEMPLATE level
   */
  async update(fieldId: string, dto: UpdateTemplateFieldDto): Promise<TemplateFieldResponseDto> {
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

    this.logger.log(`Template field updated: ${fieldId}`);
    return this.mapToResponse(updatedField);
  }

  /**
   * Soft delete template field
   */
  async delete(fieldId: string): Promise<void> {
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

    this.logger.log(`Template field soft deleted: ${fieldId}`);
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
