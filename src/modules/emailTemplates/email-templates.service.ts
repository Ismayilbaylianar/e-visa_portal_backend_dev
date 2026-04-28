import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  EmailTemplateResponseDto,
  EmailTemplateListResponseDto,
  GetEmailTemplatesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { isSystemTemplate, SYSTEM_TEMPLATE_KEYS } from './email-templates.constants';

/**
 * Module 3 — Email Templates CRUD.
 *
 * `templateKey` is the natural join key — `email.service.ts` looks up
 * templates by this string at runtime. The 5 system keys
 * (`SYSTEM_TEMPLATE_KEYS`) are immutable in the admin UI:
 *   - DELETE always blocked (409)
 *   - PATCH allowed for body / subject / description / isActive, but
 *     `templateKey` rename blocked (409) — renaming would silently break
 *     runtime emails.
 *
 * Mapper sets `isSystem` so the frontend can render the System badge
 * and disable the Delete control without re-deriving the rule.
 */
@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Get paginated list of email templates
   */
  async findAll(query: GetEmailTemplatesQueryDto): Promise<EmailTemplateListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'templateKey', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (search) {
      where.OR = [
        { templateKey: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.prisma.emailTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.emailTemplate.count({ where }),
    ]);

    const items = templates.map((t) => this.mapToResponse(t));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get email template by ID
   */
  async findById(id: string): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Email template does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(template);
  }

  /**
   * Create new email template
   */
  async create(
    dto: CreateEmailTemplateDto,
    actorUserId?: string,
  ): Promise<EmailTemplateResponseDto> {
    // Check template key uniqueness (covers both active and soft-deleted
    // rows because templateKey has a DB-level unique constraint that
    // doesn't exclude soft-deletes).
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { templateKey: dto.templateKey },
    });

    if (existing) {
      throw new ConflictException('Template key already exists', [
        {
          field: 'templateKey',
          reason: ErrorCodes.CONFLICT,
          message: 'An email template with this key already exists',
        },
      ]);
    }

    const template = await this.prisma.emailTemplate.create({
      data: {
        templateKey: dto.templateKey,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'emailTemplate.create',
        'EmailTemplate',
        template.id,
        undefined,
        {
          templateKey: template.templateKey,
          subject: template.subject,
          isActive: template.isActive,
          description: template.description,
        },
      );
    }

    this.logger.log(`Email template created: ${template.id} (${template.templateKey})`);
    return this.mapToResponse(template);
  }

  /**
   * Update email template
   */
  async update(
    id: string,
    dto: UpdateEmailTemplateDto,
    actorUserId?: string,
  ): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Email template does not exist or has been deleted',
        },
      ]);
    }

    // System template guard — templateKey rename would silently break
    // runtime emails (email.service.ts looks up by literal). Other
    // fields (subject / bodyHtml / bodyText / description / isActive)
    // are still editable on system templates.
    if (
      dto.templateKey !== undefined &&
      dto.templateKey !== template.templateKey &&
      isSystemTemplate(template.templateKey)
    ) {
      throw new ConflictException('System template templateKey is locked', [
        {
          field: 'templateKey',
          reason: ErrorCodes.CONFLICT,
          message: `templateKey "${template.templateKey}" is referenced in code and cannot be renamed`,
        },
      ]);
    }

    // Check template key uniqueness if changing
    if (dto.templateKey && dto.templateKey !== template.templateKey) {
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { templateKey: dto.templateKey },
      });
      if (existing) {
        throw new ConflictException('Template key already exists', [
          {
            field: 'templateKey',
            reason: ErrorCodes.CONFLICT,
            message: 'An email template with this key already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.templateKey !== undefined) updateData.templateKey = dto.templateKey;
    if (dto.subject !== undefined) updateData.subject = dto.subject;
    if (dto.bodyHtml !== undefined) updateData.bodyHtml = dto.bodyHtml;
    if (dto.bodyText !== undefined) updateData.bodyText = dto.bodyText;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedTemplate = await this.prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'emailTemplate.update',
        'EmailTemplate',
        id,
        {
          templateKey: template.templateKey,
          subject: template.subject,
          description: template.description,
          isActive: template.isActive,
        },
        {
          templateKey: updatedTemplate.templateKey,
          subject: updatedTemplate.subject,
          description: updatedTemplate.description,
          isActive: updatedTemplate.isActive,
        },
      );
    }

    this.logger.log(`Email template updated: ${id}`);
    return this.mapToResponse(updatedTemplate);
  }

  /**
   * Soft delete email template — blocked when the row is one of the
   * system templates referenced by hardcoded keys in email.service.ts.
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Email template does not exist or has been deleted',
        },
      ]);
    }

    if (isSystemTemplate(template.templateKey)) {
      throw new ConflictException('System template cannot be deleted', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `"${template.templateKey}" is a system template referenced in code (one of: ${SYSTEM_TEMPLATE_KEYS.join(', ')}). Deactivate it instead.`,
        },
      ]);
    }

    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'emailTemplate.delete',
        'EmailTemplate',
        id,
        {
          templateKey: template.templateKey,
          subject: template.subject,
          isActive: template.isActive,
        },
        undefined,
      );
    }

    this.logger.log(`Email template soft deleted: ${id} (${template.templateKey})`);
  }

  /**
   * Map template entity to response DTO. `isSystem` is computed from
   * the canonical SYSTEM_TEMPLATE_KEYS list so the frontend can render
   * the System badge and disable Delete without re-deriving the rule.
   */
  private mapToResponse(template: any): EmailTemplateResponseDto {
    return {
      id: template.id,
      templateKey: template.templateKey,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || undefined,
      description: template.description || undefined,
      isActive: template.isActive,
      isSystem: isSystemTemplate(template.templateKey),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
