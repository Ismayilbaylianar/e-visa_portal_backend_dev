import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
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

/**
 * Module 2 — Visa Types CRUD.
 *
 * Conflict semantics: (purpose, entries) is the natural key. The same
 * `purpose` (e.g. "tourism") is allowed to coexist as both SINGLE and
 * MULTIPLE entries — those are distinct offerings to the customer.
 *
 * Delete is blocked when an active TemplateBinding still references the
 * visa type. This prevents orphaning published visa offers; admin must
 * deactivate or migrate the binding first. Applications never reference
 * VisaType directly (they reference the binding fee, which references
 * the binding, which references the visa type), so the binding count is
 * the single check needed.
 */
@Injectable()
export class VisaTypesService {
  private readonly logger = new Logger(VisaTypesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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

    const items = visaTypes.map((vt) => this.mapToResponse(vt));

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
  async create(
    dto: CreateVisaTypeDto,
    actorUserId?: string,
  ): Promise<VisaTypeResponseDto> {
    // Cross-field guard (defense-in-depth — DTO validator catches it first,
    // but service-level check protects against direct service callers).
    if (dto.maxStay > dto.validityDays) {
      throw new ConflictException('Invalid visa configuration', [
        {
          field: 'maxStay',
          reason: ErrorCodes.CONFLICT,
          message: 'maxStay cannot exceed validityDays',
        },
      ]);
    }

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
          field: 'purpose',
          reason: ErrorCodes.CONFLICT,
          message: `A visa type with purpose "${dto.purpose}" and entry type "${dto.entries}" already exists`,
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.create',
        'VisaType',
        visaType.id,
        undefined,
        {
          purpose: visaType.purpose,
          entries: visaType.entries,
          label: visaType.label,
          validityDays: visaType.validityDays,
          maxStay: visaType.maxStay,
          isActive: visaType.isActive,
          sortOrder: visaType.sortOrder,
        },
      );
    }

    this.logger.log(`Visa type created: ${visaType.id} (${visaType.purpose}/${visaType.entries})`);
    return this.mapToResponse(visaType);
  }

  /**
   * Update visa type
   */
  async update(
    id: string,
    dto: UpdateVisaTypeDto,
    actorUserId?: string,
  ): Promise<VisaTypeResponseDto> {
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

    // Cross-field guard against partial updates that would invert the
    // invariant (e.g. lowering validityDays below an unchanged maxStay).
    const effectiveValidity = dto.validityDays ?? visaType.validityDays;
    const effectiveMaxStay = dto.maxStay ?? visaType.maxStay;
    if (effectiveMaxStay > effectiveValidity) {
      throw new ConflictException('Invalid visa configuration', [
        {
          field: 'maxStay',
          reason: ErrorCodes.CONFLICT,
          message: 'maxStay cannot exceed validityDays',
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
            field: 'purpose',
            reason: ErrorCodes.CONFLICT,
            message: `A visa type with purpose "${newPurpose}" and entry type "${newEntries}" already exists`,
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.update',
        'VisaType',
        id,
        {
          purpose: visaType.purpose,
          entries: visaType.entries,
          label: visaType.label,
          validityDays: visaType.validityDays,
          maxStay: visaType.maxStay,
          isActive: visaType.isActive,
          sortOrder: visaType.sortOrder,
        },
        {
          purpose: updatedVisaType.purpose,
          entries: updatedVisaType.entries,
          label: updatedVisaType.label,
          validityDays: updatedVisaType.validityDays,
          maxStay: updatedVisaType.maxStay,
          isActive: updatedVisaType.isActive,
          sortOrder: updatedVisaType.sortOrder,
        },
      );
    }

    this.logger.log(`Visa type updated: ${id}`);
    return this.mapToResponse(updatedVisaType);
  }

  /**
   * Soft delete visa type — blocked if any active TemplateBinding still
   * references it. Admin must deactivate / migrate bindings first.
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
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

    const bindingCount = await this.prisma.templateBinding.count({
      where: {
        visaTypeId: id,
        deletedAt: null,
        isActive: true,
      },
    });

    if (bindingCount > 0) {
      throw new ConflictException('Visa type is in use', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `Visa type is referenced by ${bindingCount} active template binding(s). Deactivate or remove those bindings first.`,
        },
      ]);
    }

    await this.prisma.visaType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.delete',
        'VisaType',
        id,
        {
          purpose: visaType.purpose,
          entries: visaType.entries,
          label: visaType.label,
          isActive: visaType.isActive,
        },
        undefined,
      );
    }

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

    const items = visaTypes.map((vt) => this.mapToPublicResponse(vt));

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
