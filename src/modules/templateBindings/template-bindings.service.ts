import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateTemplateBindingDto,
  UpdateTemplateBindingDto,
  TemplateBindingResponseDto,
  TemplateBindingListItemResponseDto,
  GetTemplateBindingsQueryDto,
  BulkUpsertDestinationsDto,
  BulkUpsertDestinationsResponseDto,
} from './dto';
import { BadRequestException, NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import type { Prisma } from '@prisma/client';

/**
 * Module 9 — Template Bindings.
 *
 * The binding row is the authoritative join between
 * (destinationCountry, visaType, template) and the per-nationality
 * fee table. The DB enforces `@@unique([destinationCountryId,
 * visaTypeId])` so duplicate active combinations are physically
 * impossible at INSERT; the runtime check below catches the
 * soft-deleted case (where the unique index doesn't apply).
 *
 * Lifecycle invariants enforced here:
 *   • Destination + visa type are immutable after creation. Swapping
 *     them silently re-routes every Application that references this
 *     binding to the wrong product, so we block it (caller must delete
 *     and recreate).
 *   • DELETE is hard-blocked when any Application still references
 *     the binding (cascade safety). Soft-deleting fees + binding under
 *     live applications would orphan the application's `templateBindingId`
 *     FK from the admin UI even though the row still exists.
 *   • Every mutation emits an audit entry. Toggling `isActive` emits
 *     `templateBinding.activate` / `.deactivate` instead of a generic
 *     update so the audit trail clearly shows publish/unpublish events.
 */
@Injectable()
export class TemplateBindingsService {
  private readonly logger = new Logger(TemplateBindingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Get paginated list of template bindings (summary view)
   */
  async findAll(
    query: GetTemplateBindingsQueryDto,
  ): Promise<{ items: TemplateBindingListItemResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search } = query;
    const skip = (page - 1) * limit;

    // Build the WHERE separately so we can layer the case-insensitive
    // search across joined relations (template name/key, destination
    // country name/iso, visa type label/purpose) without poisoning the
    // simple equality filters above. Prisma needs the filter typed for
    // the `OR` array to accept relation predicates.
    const where: Prisma.TemplateBindingWhereInput = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.destinationCountryId && { destinationCountryId: query.destinationCountryId }),
      ...(query.visaTypeId && { visaTypeId: query.visaTypeId }),
      ...(query.templateId && { templateId: query.templateId }),
    };

    if (search && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { template: { name: { contains: term, mode: 'insensitive' } } },
        { template: { key: { contains: term, mode: 'insensitive' } } },
        { destinationCountry: { name: { contains: term, mode: 'insensitive' } } },
        { destinationCountry: { isoCode: { contains: term, mode: 'insensitive' } } },
        { visaType: { label: { contains: term, mode: 'insensitive' } } },
        { visaType: { purpose: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [bindings, total] = await Promise.all([
      this.prisma.templateBinding.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          destinationCountry: {
            select: { id: true, name: true, isoCode: true },
          },
          visaType: {
            select: { id: true, label: true, purpose: true },
          },
          template: {
            select: { id: true, name: true, key: true },
          },
          _count: {
            select: {
              nationalityFees: {
                where: { deletedAt: null },
              },
            },
          },
        },
      }),
      this.prisma.templateBinding.count({ where }),
    ]);

    const items = bindings.map(binding => this.mapToListItemResponse(binding));

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

  /**
   * Get template binding by ID with full details including nationality fees
   */
  async findById(id: string): Promise<TemplateBindingResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
      include: {
        destinationCountry: {
          select: { id: true, name: true, isoCode: true },
        },
        visaType: {
          select: { id: true, label: true, purpose: true },
        },
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: { deletedAt: null },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
          orderBy: {
            nationalityCountry: { name: 'asc' },
          },
        },
      },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(binding);
  }

  /**
   * Create a new template binding.
   *
   * Duplicate rules:
   *   • An active binding for (destination, visaType) blocks creation
   *     with 409 — caller should edit the existing one or deactivate it.
   *   • A SOFT-DELETED binding for the same pair is *revived* in place
   *     rather than a fresh INSERT. The DB unique index on
   *     `(destination_country_id, visa_type_id)` is unconditional
   *     (doesn't exclude `deleted_at IS NOT NULL`) so a fresh INSERT
   *     would 500 against the constraint. Reviving keeps the row id
   *     stable (avoiding orphaned references) and applies the new
   *     template/isActive/dates.
   */
  async create(
    dto: CreateTemplateBindingDto,
    actorUserId?: string,
  ): Promise<TemplateBindingResponseDto> {
    // First: any binding (active OR soft-deleted) for this combo?
    // We need to know which case to take: 409, revive, or fresh insert.
    const anyExisting = await this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId: dto.destinationCountryId,
        visaTypeId: dto.visaTypeId,
      },
    });

    if (anyExisting && anyExisting.deletedAt === null) {
      throw new ConflictException('Template binding already exists', [
        {
          reason: ErrorCodes.CONFLICT,
          message:
            'A template binding already exists for this destination country and visa type combination',
        },
      ]);
    }

    await this.validateRelations(dto);

    const includeShape = {
      destinationCountry: {
        select: { id: true, name: true, isoCode: true },
      },
      visaType: {
        select: { id: true, label: true, purpose: true },
      },
      template: {
        select: { id: true, name: true, key: true },
      },
      nationalityFees: {
        where: { deletedAt: null },
        include: {
          nationalityCountry: {
            select: { id: true, name: true, isoCode: true },
          },
        },
      },
    } as const;

    const binding = anyExisting
      ? // Revival path — clear deletedAt and apply the new field values.
        // Note: any soft-deleted nationality fees stay deleted; admin
        // adds fresh fee rows on the detail page after revival.
        await this.prisma.templateBinding.update({
          where: { id: anyExisting.id },
          data: {
            deletedAt: null,
            templateId: dto.templateId,
            isActive: dto.isActive ?? true,
            validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
            validTo: dto.validTo ? new Date(dto.validTo) : null,
            // M11.2 — per-binding expedited config (canonical source).
            expeditedEnabled: dto.expeditedEnabled ?? false,
            expeditedFeeAmount:
              dto.expeditedFeeAmount !== undefined ? dto.expeditedFeeAmount : null,
          },
          include: includeShape,
        })
      : await this.prisma.templateBinding.create({
          data: {
            destinationCountryId: dto.destinationCountryId,
            visaTypeId: dto.visaTypeId,
            templateId: dto.templateId,
            isActive: dto.isActive ?? true,
            validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
            validTo: dto.validTo ? new Date(dto.validTo) : null,
            // M11.2 — per-binding expedited config.
            expeditedEnabled: dto.expeditedEnabled ?? false,
            expeditedFeeAmount: dto.expeditedFeeAmount,
          },
          include: includeShape,
        });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'templateBinding.create',
        'TemplateBinding',
        binding.id,
        undefined,
        {
          destinationCountryId: binding.destinationCountryId,
          visaTypeId: binding.visaTypeId,
          templateId: binding.templateId,
          isActive: binding.isActive,
          validFrom: binding.validFrom,
          validTo: binding.validTo,
        },
      );
    }

    this.logger.log(`Template binding created: ${binding.id}`);
    return this.mapToResponse(binding);
  }

  /**
   * Update template binding. Destination + visa type are immutable
   * after creation — see class doc for rationale. Supplying either
   * with a different value than the current row is rejected (409).
   *
   * `isActive` toggles emit a more specific audit key
   * (`templateBinding.activate` / `.deactivate`) so the audit trail
   * highlights publish/unpublish events vs other field edits.
   */
  async update(
    id: string,
    dto: UpdateTemplateBindingDto,
    actorUserId?: string,
  ): Promise<TemplateBindingResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Hard-block destination + visa type swaps. Allowing them would
    // silently re-route every Application referencing this binding to
    // the wrong product. Caller must delete + recreate to change.
    if (
      dto.destinationCountryId !== undefined &&
      dto.destinationCountryId !== binding.destinationCountryId
    ) {
      throw new ConflictException('Destination country is immutable', [
        {
          field: 'destinationCountryId',
          reason: ErrorCodes.CONFLICT,
          message:
            'Destination country cannot be changed after binding creation. Delete this binding and create a new one.',
        },
      ]);
    }
    if (dto.visaTypeId !== undefined && dto.visaTypeId !== binding.visaTypeId) {
      throw new ConflictException('Visa type is immutable', [
        {
          field: 'visaTypeId',
          reason: ErrorCodes.CONFLICT,
          message:
            'Visa type cannot be changed after binding creation. Delete this binding and create a new one.',
        },
      ]);
    }

    await this.validateRelations(dto);

    const updateData: any = {};
    if (dto.destinationCountryId !== undefined)
      updateData.destinationCountryId = dto.destinationCountryId;
    if (dto.visaTypeId !== undefined) updateData.visaTypeId = dto.visaTypeId;
    if (dto.templateId !== undefined) updateData.templateId = dto.templateId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.validFrom !== undefined)
      updateData.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) updateData.validTo = dto.validTo ? new Date(dto.validTo) : null;
    // M11.2 — per-binding expedited config.
    if (dto.expeditedEnabled !== undefined)
      updateData.expeditedEnabled = dto.expeditedEnabled;
    if (dto.expeditedFeeAmount !== undefined)
      updateData.expeditedFeeAmount = dto.expeditedFeeAmount;

    const updatedBinding = await this.prisma.templateBinding.update({
      where: { id },
      data: updateData,
      include: {
        destinationCountry: {
          select: { id: true, name: true, isoCode: true },
        },
        visaType: {
          select: { id: true, label: true, purpose: true },
        },
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: { deletedAt: null },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
          orderBy: {
            nationalityCountry: { name: 'asc' },
          },
        },
      },
    });

    if (actorUserId) {
      // Pick the most specific audit key. An admin who toggles
      // isActive in the UI almost always doesn't touch other fields,
      // so the more specific activate/deactivate signal is what shows
      // up in the audit feed for that common case.
      const isActiveChanged =
        dto.isActive !== undefined && dto.isActive !== binding.isActive;
      const onlyIsActive =
        isActiveChanged &&
        Object.keys(dto).every((k) =>
          ['isActive', 'destinationCountryId', 'visaTypeId'].includes(k),
        );

      const action = onlyIsActive
        ? dto.isActive
          ? 'templateBinding.activate'
          : 'templateBinding.deactivate'
        : 'templateBinding.update';

      await this.auditLogsService.logAdminAction(
        actorUserId,
        action,
        'TemplateBinding',
        id,
        {
          templateId: binding.templateId,
          isActive: binding.isActive,
          validFrom: binding.validFrom,
          validTo: binding.validTo,
        },
        {
          templateId: updatedBinding.templateId,
          isActive: updatedBinding.isActive,
          validFrom: updatedBinding.validFrom,
          validTo: updatedBinding.validTo,
        },
      );
    }

    this.logger.log(`Template binding updated: ${id}`);
    return this.mapToResponse(updatedBinding);
  }

  /**
   * Soft delete a template binding and its fees in one transaction —
   * but ONLY when no Application still references it. Apps store
   * `templateBindingId` as a non-nullable FK; soft-deleting a binding
   * with live apps would orphan the lookup ("binding not found")
   * across the admin UI even though the row still exists.
   *
   * Returns the audit-relevant before-snapshot to the caller via the
   * AuditLogs entry; the controller doesn't need anything back.
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Cascade safety — block when applications reference this binding.
    // Excluding soft-deleted apps is fine because once an app is
    // soft-deleted it's already out of every customer-facing flow.
    const applicationCount = await this.prisma.application.count({
      where: { templateBindingId: id, deletedAt: null },
    });

    if (applicationCount > 0) {
      throw new ConflictException('Binding has active applications', [
        {
          field: 'id',
          reason: ErrorCodes.CONFLICT,
          message: `${applicationCount} application(s) reference this binding. Resolve them (complete, cancel, or refund) before deleting.`,
        },
      ]);
    }

    const now = new Date();
    const feeCount = await this.prisma.bindingNationalityFee.count({
      where: { templateBindingId: id, deletedAt: null },
    });

    await this.prisma.$transaction([
      // Soft delete all nationality fees
      this.prisma.bindingNationalityFee.updateMany({
        where: { templateBindingId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Soft delete binding
      this.prisma.templateBinding.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'templateBinding.delete',
        'TemplateBinding',
        id,
        {
          destinationCountryId: binding.destinationCountryId,
          visaTypeId: binding.visaTypeId,
          templateId: binding.templateId,
          isActive: binding.isActive,
          cascadedFeeCount: feeCount,
        },
        undefined,
      );
    }

    this.logger.log(
      `Template binding soft deleted: ${id} (cascaded ${feeCount} fees)`,
    );
  }

  /**
   * Find active binding for public selection (with date validity check)
   */
  async findActiveBinding(destinationCountryId: string, visaTypeId: string): Promise<any | null> {
    const now = new Date();

    return this.prisma.templateBinding.findFirst({
      where: {
        destinationCountryId,
        visaTypeId,
        isActive: true,
        deletedAt: null,
        OR: [{ validFrom: null }, { validFrom: { lte: now } }],
        AND: [
          {
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
        ],
      },
      include: {
        template: {
          select: { id: true, name: true, key: true },
        },
        nationalityFees: {
          where: {
            isActive: true,
            deletedAt: null,
          },
          include: {
            nationalityCountry: {
              select: { id: true, name: true, isoCode: true },
            },
          },
        },
      },
    });
  }

  private async validateRelations(
    dto: CreateTemplateBindingDto | UpdateTemplateBindingDto,
  ): Promise<void> {
    if (dto.destinationCountryId) {
      const country = await this.prisma.country.findFirst({
        where: { id: dto.destinationCountryId, deletedAt: null },
      });
      if (!country) {
        throw new NotFoundException('Destination country not found', [
          {
            reason: ErrorCodes.COUNTRY_NOT_FOUND,
            message: 'Destination country does not exist or has been deleted',
          },
        ]);
      }
    }

    if (dto.visaTypeId) {
      const visaType = await this.prisma.visaType.findFirst({
        where: { id: dto.visaTypeId, deletedAt: null },
      });
      if (!visaType) {
        throw new NotFoundException('Visa type not found', [
          {
            reason: ErrorCodes.VISA_TYPE_NOT_FOUND,
            message: 'Visa type does not exist or has been deleted',
          },
        ]);
      }
    }

    if (dto.templateId) {
      const template = await this.prisma.template.findFirst({
        where: { id: dto.templateId, deletedAt: null },
      });
      if (!template) {
        throw new NotFoundException('Template not found', [
          {
            reason: ErrorCodes.TEMPLATE_NOT_FOUND,
            message: 'Template does not exist or has been deleted',
          },
        ]);
      }
    }
  }

  private mapToListItemResponse(binding: any): TemplateBindingListItemResponseDto {
    return {
      id: binding.id,
      destinationCountryId: binding.destinationCountryId,
      visaTypeId: binding.visaTypeId,
      templateId: binding.templateId,
      isActive: binding.isActive,
      validFrom: binding.validFrom || null,
      validTo: binding.validTo || null,
      nationalityFeesCount: binding._count?.nationalityFees ?? 0,
      expeditedEnabled: binding.expeditedEnabled ?? false,
      expeditedFeeAmount: binding.expeditedFeeAmount?.toString() ?? null,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
      destinationCountry: binding.destinationCountry
        ? {
            id: binding.destinationCountry.id,
            name: binding.destinationCountry.name,
            isoCode: binding.destinationCountry.isoCode,
          }
        : undefined,
      visaType: binding.visaType
        ? {
            id: binding.visaType.id,
            label: binding.visaType.label,
            purpose: binding.visaType.purpose,
          }
        : undefined,
      template: binding.template
        ? {
            id: binding.template.id,
            name: binding.template.name,
            key: binding.template.key,
          }
        : undefined,
    };
  }

  private mapToResponse(binding: any): TemplateBindingResponseDto {
    return {
      id: binding.id,
      destinationCountryId: binding.destinationCountryId,
      visaTypeId: binding.visaTypeId,
      templateId: binding.templateId,
      isActive: binding.isActive,
      validFrom: binding.validFrom || null,
      validTo: binding.validTo || null,
      // M11.2 — binding-level express-processing default. Public
      // preview reads availability + headline fee from these.
      expeditedEnabled: binding.expeditedEnabled ?? false,
      expeditedFeeAmount: binding.expeditedFeeAmount?.toString() ?? null,
      createdAt: binding.createdAt,
      updatedAt: binding.updatedAt,
      destinationCountry: binding.destinationCountry
        ? {
            id: binding.destinationCountry.id,
            name: binding.destinationCountry.name,
            isoCode: binding.destinationCountry.isoCode,
          }
        : undefined,
      visaType: binding.visaType
        ? {
            id: binding.visaType.id,
            label: binding.visaType.label,
            purpose: binding.visaType.purpose,
          }
        : undefined,
      template: binding.template
        ? {
            id: binding.template.id,
            name: binding.template.name,
            key: binding.template.key,
          }
        : undefined,
      nationalityFees: (binding.nationalityFees || []).map((fee: any) => ({
        id: fee.id,
        nationalityCountryId: fee.nationalityCountryId,
        nationalityCountry: fee.nationalityCountry
          ? {
              id: fee.nationalityCountry.id,
              name: fee.nationalityCountry.name,
              isoCode: fee.nationalityCountry.isoCode,
            }
          : undefined,
        governmentFeeAmount: fee.governmentFeeAmount.toString(),
        serviceFeeAmount: fee.serviceFeeAmount.toString(),
        expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || null,
        currencyCode: fee.currencyCode,
        expeditedEnabled: fee.expeditedEnabled,
        isActive: fee.isActive,
        createdAt: fee.createdAt,
        updatedAt: fee.updatedAt,
      })),
    };
  }

  /**
   * M11.2 — Bulk upsert destinations for one (template, nationality,
   * visaType) scope.
   *
   * Lets the admin Destination Manager UI manage 50+ destination rows
   * per (nationality, visaType) combo in a single round trip. Atomic
   * via a single Prisma transaction — partial failures roll back so
   * the admin doesn't end up with half-applied price changes.
   *
   * For each input row:
   *   • If `isActive=true` and binding exists → update binding fields
   *     + revive (`deletedAt=null`) + upsert nationality fee.
   *   • If `isActive=true` and binding missing → create binding +
   *     create fee.
   *   • If `isActive=false` and binding exists → soft-delete binding
   *     (sets `deletedAt`). Per-fee rows stay; revived bindings can
   *     re-use them.
   *   • If `isActive=false` and binding missing → counted as `skipped`.
   *
   * Boilerplate guard: throws 400 if the requested template is a
   * boilerplate. Per the brief, boilerplates are clones-only and
   * never directly bindable to a customer-facing combo.
   */
  async bulkUpsertDestinations(
    templateId: string,
    dto: BulkUpsertDestinationsDto,
    actorUserId: string,
  ): Promise<BulkUpsertDestinationsResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
      select: { id: true, key: true, isBoilerplate: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Template does not exist' },
      ]);
    }
    if (template.isBoilerplate) {
      throw new BadRequestException('Cannot bind a boilerplate template', [
        {
          reason: ErrorCodes.BAD_REQUEST,
          message:
            'Boilerplates are not directly bindable. Clone the template first via POST /admin/templates/:id/duplicate, then manage destinations on the clone.',
        },
      ]);
    }

    // Validate every row references a real, active country before we
    // open the transaction — fail fast on bad input.
    const destinationIds = dto.destinations.map((d) => d.destinationCountryId);
    const knownDestinations = await this.prisma.country.findMany({
      where: { id: { in: destinationIds }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (knownDestinations.length !== destinationIds.length) {
      const missing = destinationIds.filter(
        (id) => !knownDestinations.some((c) => c.id === id),
      );
      throw new BadRequestException('Some destination countries not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: `Unknown or inactive destination ids: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? `, … (+${missing.length - 3})` : ''}`,
        },
      ]);
    }
    const nationality = await this.prisma.country.findFirst({
      where: { id: dto.nationalityCountryId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!nationality) {
      throw new BadRequestException('Nationality country not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Unknown or inactive nationality' },
      ]);
    }
    const visaType = await this.prisma.visaType.findFirst({
      where: { id: dto.visaTypeId, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!visaType) {
      throw new BadRequestException('Visa type not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Unknown or inactive visa type' },
      ]);
    }

    // Reject same-country combos at validation time (matches the M10
    // public same-country block at the data layer).
    for (const row of dto.destinations) {
      if (row.destinationCountryId === dto.nationalityCountryId) {
        throw new BadRequestException('Cannot bind same-country combo', [
          {
            reason: ErrorCodes.BAD_REQUEST,
            message: `destinationCountryId equals nationalityCountryId for at least one row`,
          },
        ]);
      }
    }

    // Atomic execution — every row commits or none do.
    let created = 0;
    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.destinations) {
        const existing = await tx.templateBinding.findFirst({
          where: {
            destinationCountryId: row.destinationCountryId,
            visaTypeId: dto.visaTypeId,
          },
          select: { id: true, deletedAt: true, templateId: true, isActive: true },
        });

        if (!row.isActive) {
          // De-activation path — soft-delete if exists; otherwise no-op.
          if (existing && existing.deletedAt === null) {
            await tx.templateBinding.update({
              where: { id: existing.id },
              data: { deletedAt: new Date(), isActive: false },
            });
            deleted++;
          } else {
            skipped++;
          }
          continue;
        }

        // Activation / upsert path.
        let bindingId: string;
        if (existing) {
          await tx.templateBinding.update({
            where: { id: existing.id },
            data: {
              templateId,
              isActive: true,
              deletedAt: null,
              expeditedEnabled: row.expeditedEnabled,
              expeditedFeeAmount: row.expeditedEnabled
                ? row.expeditedFeeAmount ?? null
                : null,
            },
          });
          bindingId = existing.id;
          updated++;
        } else {
          const fresh = await tx.templateBinding.create({
            data: {
              destinationCountryId: row.destinationCountryId,
              visaTypeId: dto.visaTypeId,
              templateId,
              isActive: true,
              expeditedEnabled: row.expeditedEnabled,
              expeditedFeeAmount: row.expeditedEnabled
                ? row.expeditedFeeAmount ?? null
                : null,
            },
          });
          bindingId = fresh.id;
          created++;
        }

        // Upsert the per-nationality fee for this binding. The fee
        // table's unique key is (templateBindingId, nationalityCountryId)
        // — exactly the right grain for this scope.
        const existingFee = await tx.bindingNationalityFee.findUnique({
          where: {
            templateBindingId_nationalityCountryId: {
              templateBindingId: bindingId,
              nationalityCountryId: dto.nationalityCountryId,
            },
          },
        });
        if (existingFee) {
          await tx.bindingNationalityFee.update({
            where: { id: existingFee.id },
            data: {
              governmentFeeAmount: row.governmentFeeAmount,
              serviceFeeAmount: row.serviceFeeAmount,
              currencyCode: row.currencyCode,
              // Keep per-fee expedited columns in sync with binding-level
              // for backwards-compat readers, but binding remains canonical.
              expeditedEnabled: row.expeditedEnabled,
              expeditedFeeAmount: row.expeditedEnabled
                ? row.expeditedFeeAmount ?? null
                : null,
              isActive: true,
              deletedAt: null,
            },
          });
        } else {
          await tx.bindingNationalityFee.create({
            data: {
              templateBindingId: bindingId,
              nationalityCountryId: dto.nationalityCountryId,
              governmentFeeAmount: row.governmentFeeAmount,
              serviceFeeAmount: row.serviceFeeAmount,
              currencyCode: row.currencyCode,
              expeditedEnabled: row.expeditedEnabled,
              expeditedFeeAmount: row.expeditedEnabled
                ? row.expeditedFeeAmount ?? null
                : null,
              isActive: true,
            },
          });
        }
      }
    });

    await this.auditLogsService.logAdminAction(
      actorUserId,
      'templateBinding.bulk_upsert',
      'Template',
      templateId,
      undefined,
      {
        templateId,
        nationalityCountryId: dto.nationalityCountryId,
        visaTypeId: dto.visaTypeId,
        rowCount: dto.destinations.length,
        created,
        updated,
        deleted,
        skipped,
      },
    );

    this.logger.log(
      `bulk_upsert template=${templateId} nationality=${dto.nationalityCountryId} visa=${dto.visaTypeId} → +${created} ~${updated} -${deleted} (${skipped} skipped)`,
    );

    return { created, updated, deleted, skipped };
  }
}
