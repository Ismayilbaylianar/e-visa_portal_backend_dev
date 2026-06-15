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
  VisaTypeEntryResponseDto,
  CreateVisaTypeEntryDto,
  UpdateVisaTypeEntryDto,
} from './dto';
import { NotFoundException, ConflictException, BadRequestException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

/**
 * Module 2 — Visa Types CRUD (entries feature).
 *
 * A VisaType is now identity + display (purpose, label, description).
 * Validity / max stay / entry label live on per-type `VisaTypeEntry`
 * rows; on create we seed 3 defaults (Single/Double/Multiple). Pricing
 * is per-entry on BindingNationalityFee.entryId.
 *
 * Delete is blocked when an active TemplateBinding still references the
 * visa type. The entry-delete is blocked when a fee references it
 * (the FK is ON DELETE RESTRICT — we surface a friendly 409 first).
 */
@Injectable()
export class VisaTypesService {
  private readonly logger = new Logger(VisaTypesService.name);

  /** Default entries seeded when a visa type is created. Admin edits after. */
  private static readonly DEFAULT_ENTRIES: Array<{
    entryLabel: string;
    entryKey: string;
    validityDays: number;
    maxStayDays: number;
  }> = [
    { entryLabel: 'Single', entryKey: 'single', validityDays: 30, maxStayDays: 30 },
    { entryLabel: 'Double', entryKey: 'double', validityDays: 90, maxStayDays: 30 },
    { entryLabel: 'Multiple', entryKey: 'multiple', validityDays: 180, maxStayDays: 30 },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  // ============ Visa types ============

  async findAll(query: GetVisaTypesQueryDto): Promise<VisaTypeListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'sortOrder', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.isActive !== undefined) where.isActive = query.isActive;
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
        include: { entries: this.activeEntriesInclude() },
      }),
      this.prisma.visaType.count({ where }),
    ]);

    return {
      items: visaTypes.map((vt) => this.mapToResponse(vt)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({
      where: { id, deletedAt: null },
      include: { entries: this.activeEntriesInclude() },
    });
    if (!visaType) throw this.notFound();
    return this.mapToResponse(visaType);
  }

  async create(dto: CreateVisaTypeDto, actorUserId?: string): Promise<VisaTypeResponseDto> {
    // Seed the visa type + its 3 default entries atomically so a partial
    // create can't leave a visa type with no entries.
    const visaType = await this.prisma.$transaction(async (tx) => {
      const created = await tx.visaType.create({
        data: {
          purpose: dto.purpose,
          label: dto.label,
          description: dto.description,
          isActive: dto.isActive ?? true,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
      await tx.visaTypeEntry.createMany({
        data: VisaTypesService.DEFAULT_ENTRIES.map((e, i) => ({
          visaTypeId: created.id,
          entryLabel: e.entryLabel,
          entryKey: e.entryKey,
          validityDays: e.validityDays,
          maxStayDays: e.maxStayDays,
          sortOrder: i,
          isActive: true,
        })),
      });
      return tx.visaType.findUniqueOrThrow({
        where: { id: created.id },
        include: { entries: this.activeEntriesInclude() },
      });
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.create',
        'VisaType',
        visaType.id,
        undefined,
        { purpose: visaType.purpose, label: visaType.label, seededEntries: visaType.entries.length },
      );
    }

    this.logger.log(`Visa type created: ${visaType.id} (${visaType.purpose}) + ${visaType.entries.length} entries`);
    return this.mapToResponse(visaType);
  }

  async update(id: string, dto: UpdateVisaTypeDto, actorUserId?: string): Promise<VisaTypeResponseDto> {
    const visaType = await this.prisma.visaType.findFirst({ where: { id, deletedAt: null } });
    if (!visaType) throw this.notFound();

    const updateData: any = {};
    if (dto.purpose !== undefined) updateData.purpose = dto.purpose;
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    await this.prisma.visaType.update({ where: { id }, data: updateData });
    const updated = await this.prisma.visaType.findUniqueOrThrow({
      where: { id },
      include: { entries: this.activeEntriesInclude() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.update',
        'VisaType',
        id,
        { purpose: visaType.purpose, label: visaType.label, isActive: visaType.isActive, sortOrder: visaType.sortOrder },
        { purpose: updated.purpose, label: updated.label, isActive: updated.isActive, sortOrder: updated.sortOrder },
      );
    }

    this.logger.log(`Visa type updated: ${id}`);
    return this.mapToResponse(updated);
  }

  async delete(id: string, actorUserId?: string): Promise<void> {
    const visaType = await this.prisma.visaType.findFirst({ where: { id, deletedAt: null } });
    if (!visaType) throw this.notFound();

    const bindingCount = await this.prisma.templateBinding.count({
      where: { visaTypeId: id, deletedAt: null, isActive: true },
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

    await this.prisma.visaType.update({ where: { id }, data: { deletedAt: new Date() } });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaType.delete',
        'VisaType',
        id,
        { purpose: visaType.purpose, label: visaType.label, isActive: visaType.isActive },
        undefined,
      );
    }
    this.logger.log(`Visa type soft deleted: ${id}`);
  }

  async findAllPublic(): Promise<PublicVisaTypeListResponseDto> {
    const visaTypes = await this.prisma.visaType.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { entries: this.activeEntriesInclude() },
    });
    return {
      items: visaTypes.map((vt) => this.mapToPublicResponse(vt)),
      total: visaTypes.length,
    };
  }

  // ============ Visa type entries ============

  async createEntry(
    visaTypeId: string,
    dto: CreateVisaTypeEntryDto,
    actorUserId?: string,
  ): Promise<VisaTypeEntryResponseDto> {
    await this.assertVisaTypeExists(visaTypeId);
    this.assertDurations(dto.maxStayDays, dto.validityDays);

    // Append at the end unless an explicit sortOrder is given.
    const sortOrder =
      dto.sortOrder ??
      ((
        await this.prisma.visaTypeEntry.aggregate({
          where: { visaTypeId, deletedAt: null },
          _max: { sortOrder: true },
        })
      )._max.sortOrder ?? -1) + 1;

    const entry = await this.prisma.visaTypeEntry.create({
      data: {
        visaTypeId,
        entryLabel: dto.entryLabel,
        entryKey: dto.entryKey,
        validityDays: dto.validityDays,
        maxStayDays: dto.maxStayDays,
        sortOrder,
        isActive: dto.isActive ?? true,
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaTypeEntry.create',
        'VisaTypeEntry',
        entry.id,
        undefined,
        { visaTypeId, entryLabel: entry.entryLabel, validityDays: entry.validityDays, maxStayDays: entry.maxStayDays },
      );
    }
    return this.mapEntry(entry);
  }

  async updateEntry(
    entryId: string,
    dto: UpdateVisaTypeEntryDto,
    actorUserId?: string,
  ): Promise<VisaTypeEntryResponseDto> {
    const entry = await this.prisma.visaTypeEntry.findFirst({ where: { id: entryId, deletedAt: null } });
    if (!entry) throw this.entryNotFound();

    const effValidity = dto.validityDays ?? entry.validityDays;
    const effMaxStay = dto.maxStayDays ?? entry.maxStayDays;
    this.assertDurations(effMaxStay, effValidity);

    const data: any = {};
    if (dto.entryLabel !== undefined) data.entryLabel = dto.entryLabel;
    if (dto.entryKey !== undefined) data.entryKey = dto.entryKey;
    if (dto.validityDays !== undefined) data.validityDays = dto.validityDays;
    if (dto.maxStayDays !== undefined) data.maxStayDays = dto.maxStayDays;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.visaTypeEntry.update({ where: { id: entryId }, data });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaTypeEntry.update',
        'VisaTypeEntry',
        entryId,
        { entryLabel: entry.entryLabel, validityDays: entry.validityDays, maxStayDays: entry.maxStayDays, isActive: entry.isActive },
        { entryLabel: updated.entryLabel, validityDays: updated.validityDays, maxStayDays: updated.maxStayDays, isActive: updated.isActive },
      );
    }
    return this.mapEntry(updated);
  }

  async deleteEntry(entryId: string, actorUserId?: string): Promise<void> {
    const entry = await this.prisma.visaTypeEntry.findFirst({ where: { id: entryId, deletedAt: null } });
    if (!entry) throw this.entryNotFound();

    // Block deletion when a fee row still references the entry (FK is
    // ON DELETE RESTRICT — surface a friendly 409 before the DB throws).
    const feeCount = await this.prisma.bindingNationalityFee.count({
      where: { entryId, deletedAt: null },
    });
    if (feeCount > 0) {
      throw new ConflictException('Entry is in use', [
        {
          field: 'entryId',
          reason: ErrorCodes.CONFLICT,
          message: `This entry is priced in ${feeCount} binding fee row(s). Remove those fees first.`,
        },
      ]);
    }

    await this.prisma.visaTypeEntry.update({ where: { id: entryId }, data: { deletedAt: new Date() } });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaTypeEntry.delete',
        'VisaTypeEntry',
        entryId,
        { visaTypeId: entry.visaTypeId, entryLabel: entry.entryLabel },
        undefined,
      );
    }
  }

  /**
   * Atomic bulk reorder — sets sortOrder = index for every non-deleted
   * entry on the visa type. Requires the full set (partial reorders
   * rejected). Mirrors the country-sections / template-sections pattern.
   */
  async reorderEntries(
    visaTypeId: string,
    orderedIds: string[],
    actorUserId?: string,
  ): Promise<VisaTypeEntryResponseDto[]> {
    await this.assertVisaTypeExists(visaTypeId);

    const current = await this.prisma.visaTypeEntry.findMany({
      where: { visaTypeId, deletedAt: null },
      select: { id: true },
    });
    const currentIds = new Set(current.map((e) => e.id));
    const incoming = new Set(orderedIds);
    if (
      orderedIds.length !== current.length ||
      orderedIds.some((id) => !currentIds.has(id)) ||
      current.some((e) => !incoming.has(e.id))
    ) {
      throw new BadRequestException('Reorder set mismatch', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message: 'orderedIds must contain exactly the visa type’s current entries',
        },
      ]);
    }

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.visaTypeEntry.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'visaTypeEntry.reorder',
        'VisaType',
        visaTypeId,
        undefined,
        { orderedIds },
      );
    }

    const entries = await this.prisma.visaTypeEntry.findMany({
      where: { visaTypeId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return entries.map((e) => this.mapEntry(e));
  }

  // ============ helpers ============

  private activeEntriesInclude() {
    return {
      where: { deletedAt: null },
      orderBy: { sortOrder: 'asc' as const },
    };
  }

  private assertDurations(maxStayDays: number, validityDays: number): void {
    if (maxStayDays > validityDays) {
      throw new ConflictException('Invalid entry configuration', [
        {
          field: 'maxStayDays',
          reason: ErrorCodes.CONFLICT,
          message: 'maxStayDays cannot exceed validityDays',
        },
      ]);
    }
  }

  private async assertVisaTypeExists(visaTypeId: string): Promise<void> {
    const exists = await this.prisma.visaType.findFirst({
      where: { id: visaTypeId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw this.notFound();
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Visa type not found', [
      { reason: ErrorCodes.VISA_TYPE_NOT_FOUND, message: 'Visa type does not exist or has been deleted' },
    ]);
  }

  private entryNotFound(): NotFoundException {
    return new NotFoundException('Visa type entry not found', [
      { reason: ErrorCodes.NOT_FOUND, message: 'Entry does not exist or has been deleted' },
    ]);
  }

  private mapEntry(e: any): VisaTypeEntryResponseDto {
    return {
      id: e.id,
      entryLabel: e.entryLabel,
      entryKey: e.entryKey ?? null,
      validityDays: e.validityDays,
      maxStayDays: e.maxStayDays,
      sortOrder: e.sortOrder,
      isActive: e.isActive,
    };
  }

  private mapToResponse(visaType: any): VisaTypeResponseDto {
    return {
      id: visaType.id,
      purpose: visaType.purpose,
      label: visaType.label,
      description: visaType.description || undefined,
      isActive: visaType.isActive,
      sortOrder: visaType.sortOrder,
      entries: (visaType.entries ?? []).map((e: any) => this.mapEntry(e)),
      createdAt: visaType.createdAt,
      updatedAt: visaType.updatedAt,
    };
  }

  private mapToPublicResponse(visaType: any): PublicVisaTypeResponseDto {
    return {
      id: visaType.id,
      purpose: visaType.purpose,
      label: visaType.label,
      description: visaType.description || undefined,
      // Public sees active entries only.
      entries: (visaType.entries ?? [])
        .filter((e: any) => e.isActive)
        .map((e: any) => this.mapEntry(e)),
    };
  }
}
