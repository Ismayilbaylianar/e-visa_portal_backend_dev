import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVisaTypeDto,
  UpdateVisaTypeDto,
  VisaTypeResponseDto,
  GetVisaTypesQueryDto,
} from './dto';
import { NotFoundException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class VisaTypesService {
  private readonly logger = new Logger(VisaTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    query: GetVisaTypesQueryDto,
  ): Promise<{ items: VisaTypeResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'sortOrder', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
    };

    const [visaTypes, total] = await Promise.all([
      this.prisma.visaType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.visaType.count({ where }),
    ]);

    const items = visaTypes.map(visaType => this.mapToResponse(visaType));

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

  async findAllActive(): Promise<VisaTypeResponseDto[]> {
    const visaTypes = await this.prisma.visaType.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    return visaTypes.map(visaType => this.mapToResponse(visaType));
  }

  async findById(id: string): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found');
    }

    return this.mapToResponse(visaType);
  }

  async create(dto: CreateVisaTypeDto): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.create({
      data: {
        purpose: dto.purpose,
        validityDays: dto.validityDays,
        maxStay: dto.maxStay,
        entries: dto.entries,
        label: dto.label,
        description: dto.description,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    this.logger.log(`Visa type created: ${visaType.id}`);
    return this.mapToResponse(visaType);
  }

  async update(id: string, dto: UpdateVisaTypeDto): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found');
    }

    const updatedVisaType = await this.prisma.visaType.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Visa type updated: ${id}`);
    return this.mapToResponse(updatedVisaType);
  }

  async delete(id: string): Promise<void> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found');
    }

    await this.prisma.visaType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Visa type deleted: ${id}`);
  }

  private mapToResponse(visaType: any): VisaTypeResponseDto {
    return {
      id: visaType.id,
      purpose: visaType.purpose,
      validityDays: visaType.validityDays,
      maxStay: visaType.maxStay,
      entries: visaType.entries,
      label: visaType.label,
      description: visaType.description || undefined,
      isActive: visaType.isActive,
      sortOrder: visaType.sortOrder,
      createdAt: visaType.createdAt,
      updatedAt: visaType.updatedAt,
    };
  }
}
