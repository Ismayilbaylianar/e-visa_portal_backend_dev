import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateVisaTypeDto,
  UpdateVisaTypeDto,
  VisaTypeResponseDto,
  VisaTypeListResponseDto,
  GetVisaTypesQueryDto,
  PublicVisaTypeResponseDto,
  PublicVisaTypeListResponseDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

@Injectable()
export class VisaTypesService {
  private readonly logger = new Logger(VisaTypesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of visa types (admin)
   */
  async findAll(query: GetVisaTypesQueryDto): Promise<VisaTypeListResponseDto> {
    const { page = 1, limit = 10, search, sortBy = 'sortOrder', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.entries) {
      where.entries = query.entries;
    }

    if (search) {
      where.OR = [
        { purpose: { contains: search, mode: 'insensitive' } },
        { label: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [visaTypes, total] = await Promise.all([
      this.prisma.visaType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.visaType.count({ where }),
    ]);

    const items = visaTypes.map(vt => this.mapToResponse(vt));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get visa type by ID (admin)
   */
  async findById(id: string): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found', [
        {
          reason: ErrorCodes.VISA_TYPE_NOT_FOUND,
          message: 'Visa type does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(visaType);
  }

  /**
   * Create new visa type
   */
  async create(dto: CreateVisaTypeDto): Promise<VisaTypeResponseDto> {
    // Check for duplicate purpose + entries combination
    const existing = await this.prisma.visaType.findFirst({
      where: {
        purpose: dto.purpose,
        entries: dto.entries,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Visa type already exists', [
        {
          reason: ErrorCodes.CONFLICT,
          message: 'A visa type with this purpose and entry type already exists',
        },
      ]);
    }

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

    this.logger.log(`Visa type created: ${visaType.id} (${visaType.purpose})`);
    return this.mapToResponse(visaType);
  }

  /**
   * Update visa type
   */
  async update(id: string, dto: UpdateVisaTypeDto): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found', [
        {
          reason: ErrorCodes.VISA_TYPE_NOT_FOUND,
          message: 'Visa type does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate if changing purpose or entries
    if (dto.purpose || dto.entries) {
      const newPurpose = dto.purpose ?? visaType.purpose;
      const newEntries = dto.entries ?? visaType.entries;

      const existing = await this.prisma.visaType.findFirst({
        where: {
          purpose: newPurpose,
          entries: newEntries,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException('Visa type already exists', [
          {
            reason: ErrorCodes.CONFLICT,
            message: 'A visa type with this purpose and entry type already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.purpose !== undefined) updateData.purpose = dto.purpose;
    if (dto.validityDays !== undefined) updateData.validityDays = dto.validityDays;
    if (dto.maxStay !== undefined) updateData.maxStay = dto.maxStay;
    if (dto.entries !== undefined) updateData.entries = dto.entries;
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    const updatedVisaType = await this.prisma.visaType.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`Visa type updated: ${id}`);
    return this.mapToResponse(updatedVisaType);
  }

  /**
   * Soft delete visa type
   */
  async delete(id: string): Promise<void> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!visaType) {
      throw new NotFoundException('Visa type not found', [
        {
          reason: ErrorCodes.VISA_TYPE_NOT_FOUND,
          message: 'Visa type does not exist or has been deleted',
        },
      ]);
    }

    await this.prisma.visaType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    this.logger.log(`Visa type soft deleted: ${id}`);
  }

  /**
   * Get public list of visa types (active only)
   */
  async findAllPublic(): Promise<PublicVisaTypeListResponseDto> {
    const visaTypes = await this.prisma.visaType.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    const items = visaTypes.map(vt => this.mapToPublicResponse(vt));

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Map visa type entity to admin response DTO
   */
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

  /**
   * Map visa type entity to public response DTO
   */
  private mapToPublicResponse(visaType: any): PublicVisaTypeResponseDto {
    return {
      id: visaType.id,
      purpose: visaType.purpose,
      validityDays: visaType.validityDays,
      maxStay: visaType.maxStay,
      entries: visaType.entries,
      label: visaType.label,
      description: visaType.description || undefined,
    };
  }
}
