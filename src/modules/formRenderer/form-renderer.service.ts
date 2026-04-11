import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FormSchemaResponseDto, FormSectionDto, FormFieldDto, GetFormSchemaQueryDto } from './dto';
import { NotFoundException, BadRequestException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { TemplateSection, TemplateField } from '@prisma/client';

type SectionWithFields = TemplateSection & { fields: TemplateField[] };

@Injectable()
export class FormRendererService {
  private readonly logger = new Logger(FormRendererService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get form schema with flexible resolution logic:
   * 1. If applicationId is provided, use the application's resolved template
   * 2. Otherwise if templateBindingId is provided, resolve template from binding
   * 3. If applicantId is provided, verify ownership through the related application
   */
  async getSchema(
    query: GetFormSchemaQueryDto,
    portalIdentityId: string,
  ): Promise<FormSchemaResponseDto> {
    const { templateBindingId, applicationId, applicantId } = query;

    // Validate at least one parameter is provided
    if (!templateBindingId && !applicationId && !applicantId) {
      throw new BadRequestException(
        'At least one of templateBindingId, applicationId, or applicantId is required',
        [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: 'Provide templateBindingId, applicationId, or applicantId',
          },
        ],
      );
    }

    let templateId: string;

    // Resolution logic
    if (applicationId) {
      // Resolve from application
      const application = await this.prisma.application.findFirst({
        where: { id: applicationId, deletedAt: null },
      });

      if (!application) {
        throw new NotFoundException('Application not found', [
          { reason: ErrorCodes.APPLICATION_NOT_FOUND, message: 'Application does not exist' },
        ]);
      }

      // Verify ownership
      if (application.portalIdentityId !== portalIdentityId) {
        throw new ForbiddenException('Access denied', [
          { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this application' },
        ]);
      }

      templateId = application.templateId;
    } else if (applicantId) {
      // Resolve from applicant's application
      const applicant = await this.prisma.applicationApplicant.findFirst({
        where: { id: applicantId, deletedAt: null },
        include: { application: true },
      });

      if (!applicant) {
        throw new NotFoundException('Applicant not found', [
          { reason: ErrorCodes.APPLICANT_NOT_FOUND, message: 'Applicant does not exist' },
        ]);
      }

      // Verify ownership
      if (applicant.application.portalIdentityId !== portalIdentityId) {
        throw new ForbiddenException('Access denied', [
          { reason: ErrorCodes.FORBIDDEN, message: 'You do not have access to this applicant' },
        ]);
      }

      templateId = applicant.application.templateId;
    } else {
      // Resolve from template binding
      const templateBinding = await this.prisma.templateBinding.findFirst({
        where: {
          id: templateBindingId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!templateBinding) {
        throw new NotFoundException('Template binding not found', [
          {
            reason: ErrorCodes.BINDING_NOT_FOUND,
            message: 'Template binding does not exist or is inactive',
          },
        ]);
      }

      templateId = templateBinding.templateId;
    }

    // Fetch template with sections and fields
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
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
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Template does not exist' },
      ]);
    }

    const sections: FormSectionDto[] = template.sections.map((section: SectionWithFields) => ({
      id: section.id,
      title: section.title,
      key: section.key,
      description: section.description || null,
      sortOrder: section.sortOrder,
      fields: section.fields.map((field: TemplateField) => this.mapField(field)),
    }));

    this.logger.log(`Form schema retrieved for template: ${template.id}`);

    return {
      templateId: template.id,
      templateName: template.name,
      templateKey: template.key,
      sections,
    };
  }

  private mapField(field: TemplateField): FormFieldDto {
    let optionsJson: any[] | undefined;

    if (field.optionsJson) {
      try {
        const parsed =
          typeof field.optionsJson === 'string' ? JSON.parse(field.optionsJson) : field.optionsJson;
        if (Array.isArray(parsed)) {
          optionsJson = parsed;
        }
      } catch {
        optionsJson = undefined;
      }
    }

    let validationRulesJson: Record<string, any> | null = null;
    if (field.validationRulesJson) {
      try {
        validationRulesJson =
          typeof field.validationRulesJson === 'string'
            ? JSON.parse(field.validationRulesJson)
            : (field.validationRulesJson as Record<string, any>);
      } catch {
        validationRulesJson = null;
      }
    }

    let visibilityRulesJson: any[] | null = null;
    if (field.visibilityRulesJson) {
      try {
        const parsed =
          typeof field.visibilityRulesJson === 'string'
            ? JSON.parse(field.visibilityRulesJson)
            : field.visibilityRulesJson;
        if (Array.isArray(parsed)) {
          visibilityRulesJson = parsed;
        }
      } catch {
        visibilityRulesJson = null;
      }
    }

    return {
      id: field.id,
      fieldKey: field.fieldKey,
      fieldType: field.fieldType,
      label: field.label,
      placeholder: field.placeholder || null,
      helpText: field.helpText || null,
      defaultValue: field.defaultValue || null,
      isRequired: field.isRequired,
      sortOrder: field.sortOrder,
      isActive: field.isActive,
      optionsJson,
      validationRulesJson,
      visibilityRulesJson,
    };
  }
}
