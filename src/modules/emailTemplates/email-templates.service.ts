import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  EmailTemplateResponseDto,
  EmailTemplateListResponseDto,
  GetEmailTemplatesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of email templates
   */
  async findAll(query: GetEmailTemplatesQueryDto): Promise<EmailTemplateListResponseDto> {
    const { page = 1, limit = 10, search, sortBy = 'templateKey', sortOrder = 'asc' } = query;
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

    const items = templates.map(t => this.mapToResponse(t));

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
        { reason: ErrorCodes.NOT_FOUND, message: 'Email template does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(template);
  }

  /**
   * Create new email template
   */
  async create(dto: CreateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    // Check template key uniqueness
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { templateKey: dto.templateKey },
    });

    if (existing) {
      throw new ConflictException('Template key already exists', [
        { field: 'templateKey', reason: ErrorCodes.CONFLICT, message: 'An email template with this key already exists' },
      ]);
    }

    const template = await this.prisma.emailTemplate.create({
      data: {
        templateKey: dto.templateKey,
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        bodyText: dto.bodyText,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Email template created: ${template.id} (${template.templateKey})`);
    return this.mapToResponse(template);
  }

  /**
   * Update email template
   */
  async update(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Email template does not exist or has been deleted' },
      ]);
    }

    // Check template key uniqueness if changing
    if (dto.templateKey && dto.templateKey !== template.templateKey) {
      const existing = await this.prisma.emailTemplate.findUnique({
        where: { templateKey: dto.templateKey },
      });
      if (existing) {
        throw new ConflictException('Template key already exists', [
          { field: 'templateKey', reason: ErrorCodes.CONFLICT, message: 'An email template with this key already exists' },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.templateKey !== undefined) updateData.templateKey = dto.templateKey;
    if (dto.subject !== undefined) updateData.subject = dto.subject;
    if (dto.bodyHtml !== undefined) updateData.bodyHtml = dto.bodyHtml;
    if (dto.bodyText !== undefined) updateData.bodyText = dto.bodyText;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedTemplate = await this.prisma.emailTemplate.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Email template updated: ${id}`);
    return this.mapToResponse(updatedTemplate);
  }

  /**
   * Soft delete email template
   */
  async delete(id: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Email template does not exist or has been deleted' },
      ]);
    }

    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Email template soft deleted: ${id}`);
  }

  /**
   * Map template entity to response DTO
   */
  private mapToResponse(template: any): EmailTemplateResponseDto {
    return {
      id: template.id,
      templateKey: template.templateKey,
      subject: template.subject,
      bodyHtml: template.bodyHtml,
      bodyText: template.bodyText || undefined,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
