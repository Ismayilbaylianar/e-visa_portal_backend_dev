import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateFieldDto,
  UpdateTemplateFieldDto,
  TemplateFieldResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';

@Injectable()
export class TemplateFieldsService {
  private readonly logger = new Logger(TemplateFieldsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    sectionId: string,
    dto: CreateTemplateFieldDto,
  ): Promise<TemplateFieldResponseDto> {
    const section = await this.prisma.templateSection.findFirst({
      where: { id: sectionId, deletedAt: null },
    });

    if (!section) {
      throw new NotFoundException('Template section not found');
    }

    const existingField = await this.prisma.templateField.findFirst({
      where: {
        templateSectionId: sectionId,
        fieldKey: dto.fieldKey,
        deletedAt: null,
      },
    });

    if (existingField) {
      throw new ConflictException(
        'Field with this key already exists in the section',
      );
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
        optionsJson: dto.optionsJson,
        validationRulesJson: dto.validationRulesJson,
        visibilityRulesJson: dto.visibilityRulesJson,
      },
    });

    this.logger.log(`Template field created: ${field.id}`);
    return this.mapToResponse(field);
  }

  async update(
    fieldId: string,
    dto: UpdateTemplateFieldDto,
  ): Promise<TemplateFieldResponseDto> {
    const field = await this.prisma.templateField.findFirst({
      where: { id: fieldId, deletedAt: null },
    });

    if (!field) {
      throw new NotFoundException('Template field not found');
    }

    if (dto.fieldKey && dto.fieldKey !== field.fieldKey) {
      const existingField = await this.prisma.templateField.findFirst({
        where: {
          templateSectionId: field.templateSectionId,
          fieldKey: dto.fieldKey,
          deletedAt: null,
          id: { not: fieldId },
        },
      });

      if (existingField) {
        throw new ConflictException(
          'Field with this key already exists in the section',
        );
      }
    }

    const updatedField = await this.prisma.templateField.update({
      where: { id: fieldId },
      data: {
        ...(dto.fieldKey !== undefined && { fieldKey: dto.fieldKey }),
        ...(dto.fieldType !== undefined && { fieldType: dto.fieldType }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.placeholder !== undefined && { placeholder: dto.placeholder }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
        ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
        ...(dto.isRequired !== undefined && { isRequired: dto.isRequired }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.optionsJson !== undefined && { optionsJson: dto.optionsJson }),
        ...(dto.validationRulesJson !== undefined && {
          validationRulesJson: dto.validationRulesJson,
        }),
        ...(dto.visibilityRulesJson !== undefined && {
          visibilityRulesJson: dto.visibilityRulesJson,
        }),
      },
    });

    this.logger.log(`Template field updated: ${fieldId}`);
    return this.mapToResponse(updatedField);
  }

  async delete(fieldId: string): Promise<void> {
    const field = await this.prisma.templateField.findFirst({
      where: { id: fieldId, deletedAt: null },
    });

    if (!field) {
      throw new NotFoundException('Template field not found');
    }

    await this.prisma.templateField.update({
      where: { id: fieldId },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Template field deleted: ${fieldId}`);
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
      optionsJson: field.optionsJson || undefined,
      validationRulesJson: field.validationRulesJson || undefined,
      visibilityRulesJson: field.visibilityRulesJson || undefined,
      createdAt: field.createdAt,
      updatedAt: field.updatedAt,
    };
  }
}
