import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  EmailTemplateResponseDto,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';
import { PaginationQueryDto } from '@/common/dto';

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<{ items: EmailTemplateResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = { deletedAt: null };

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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    return this.mapToResponse(template);
  }

  async create(dto: CreateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    const existing = await this.prisma.emailTemplate.findFirst({
      where: { templateKey: dto.templateKey, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Email template with this key already exists');
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

    this.logger.log(`Email template created: ${template.id}`);
    return this.mapToResponse(template);
  }

  async update(id: string, dto: UpdateEmailTemplateDto): Promise<EmailTemplateResponseDto> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    if (dto.templateKey && dto.templateKey !== template.templateKey) {
      const existing = await this.prisma.emailTemplate.findFirst({
        where: { templateKey: dto.templateKey, deletedAt: null },
      });
      if (existing) {
        throw new ConflictException('Email template with this key already exists');
      }
    }

    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Email template updated: ${id}`);
    return this.mapToResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const template = await this.prisma.emailTemplate.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Email template not found');
    }

    await this.prisma.emailTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Email template deleted: ${id}`);
  }

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
