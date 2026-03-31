import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetTemplatesQueryDto,
  ): Promise<{ items: TemplateResponseDto[]; pagination: PaginationMeta }> {
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
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.template.count({ where }),
    ]);

    const items = templates.map(template => this.mapToResponse(template));

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
      throw new NotFoundException('Template not found');
    }

    return this.mapToResponse(template);
  }

  async create(dto: CreateTemplateDto): Promise<TemplateResponseDto> {
    const existingByKey = await this.prisma.template.findUnique({
      where: { key: dto.key },
    });

    if (existingByKey) {
      throw new ConflictException('Template with this key already exists');
    }

    const template = await this.prisma.template.create({
      data: {
        name: dto.name,
        key: dto.key,
        description: dto.description,
        version: dto.version ?? 1,
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

    this.logger.log(`Template created: ${template.id}`);
    return this.mapToResponse(template);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (dto.key && dto.key !== template.key) {
      const existingByKey = await this.prisma.template.findUnique({
        where: { key: dto.key },
      });
      if (existingByKey) {
        throw new ConflictException('Template with this key already exists');
      }
    }

    const updatedTemplate = await this.prisma.template.update({
      where: { id },
      data: dto,
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

  async delete(id: string): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.template.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Template deleted: ${id}`);
  }

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
          optionsJson: field.optionsJson || undefined,
          validationRulesJson: field.validationRulesJson || undefined,
          visibilityRulesJson: field.visibilityRulesJson || undefined,
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
