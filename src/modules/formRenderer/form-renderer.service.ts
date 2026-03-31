import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FormSchemaResponseDto, FormSectionDto, FormFieldDto } from './dto';
import { NotFoundException } from '@/common/exceptions';
import { TemplateSection, TemplateField } from '@prisma/client';

type SectionWithFields = TemplateSection & { fields: TemplateField[] };

@Injectable()
export class FormRendererService {
  private readonly logger = new Logger(FormRendererService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSchema(bindingId: string): Promise<FormSchemaResponseDto> {
    const templateBinding = await this.prisma.templateBinding.findFirst({
      where: {
        id: bindingId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        template: {
          include: {
            sections: {
              where: { deletedAt: null, isActive: true },
              orderBy: { sortOrder: 'asc' },
              include: {
                fields: {
                  where: { deletedAt: null, isActive: true },
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!templateBinding || !templateBinding.template) {
      throw new NotFoundException(
        'Template binding not found or no template associated',
      );
    }

    const template = templateBinding.template;

    const sections: FormSectionDto[] = template.sections.map((section: SectionWithFields) => ({
      id: section.id,
      key: section.key,
      title: section.title,
      description: section.description || undefined,
      order: section.sortOrder,
      fields: section.fields.map((field: TemplateField) => this.mapField(field)),
    }));

    this.logger.log(
      `Form schema retrieved for binding: ${bindingId}, template: ${template.id}`,
    );

    return {
      templateId: template.id,
      templateName: template.name,
      templateKey: template.key,
      templateVersion: template.version,
      sections,
    };
  }

  private mapField(field: TemplateField): FormFieldDto {
    let options: { value: string; label: string }[] | undefined;

    if (field.optionsJson) {
      try {
        const parsed =
          typeof field.optionsJson === 'string'
            ? JSON.parse(field.optionsJson)
            : field.optionsJson;
        if (Array.isArray(parsed)) {
          options = parsed.map((opt: any) => ({
            value: String(opt.value ?? opt),
            label: String(opt.label ?? opt.value ?? opt),
          }));
        }
      } catch {
        options = undefined;
      }
    }

    return {
      id: field.id,
      key: field.fieldKey,
      label: field.label,
      type: field.fieldType,
      required: field.isRequired,
      placeholder: field.placeholder || undefined,
      helpText: field.helpText || undefined,
      validationPattern: undefined,
      validationMessage: undefined,
      min: undefined,
      max: undefined,
      options,
      order: field.sortOrder,
    };
  }
}
