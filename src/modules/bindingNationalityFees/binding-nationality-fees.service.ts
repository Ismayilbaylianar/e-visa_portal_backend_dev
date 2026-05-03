import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateBindingNationalityFeeDto,
  UpdateBindingNationalityFeeDto,
  BindingNationalityFeeResponseDto,
  BulkCopyFeesDto,
  BulkCopyFeesResultDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

/**
 * Module 9 — Per-nationality fee CRUD + bulk-copy.
 *
 * Each row sits under exactly one (binding, nationality) pair — the
 * DB-level `@@unique([templateBindingId, nationalityCountryId])`
 * keeps that invariant; the runtime check in `create` covers the
 * soft-deleted case where the unique index doesn't apply.
 *
 * `bulkCopy` is the bread-and-butter admin shortcut: one source
 * nationality's fee → many targets in a single transaction. The
 * `overwriteExisting` flag is the only knob — without it, targets
 * that already have a fee are skipped (and reported back in details)
 * so admins don't accidentally clobber fees they tuned individually.
 */
@Injectable()
export class BindingNationalityFeesService {
  private readonly logger = new Logger(BindingNationalityFeesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Module 9 — list fees under one binding. Returned ordered by
   * nationality name so the admin UI doesn't need a client-side sort.
   * Useful as a standalone fetch when the page only needs fees (not
   * the full binding detail with template/visa type joins).
   */
  async findByBinding(
    bindingId: string,
  ): Promise<BindingNationalityFeeResponseDto[]> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id: bindingId, deletedAt: null },
      select: { id: true },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    const fees = await this.prisma.bindingNationalityFee.findMany({
      where: { templateBindingId: bindingId, deletedAt: null },
      include: {
        nationalityCountry: { select: { id: true, name: true, isoCode: true } },
      },
      orderBy: { nationalityCountry: { name: 'asc' } },
    });

    return fees.map((fee) => this.mapToResponse(fee));
  }

  /**
   * Create a new nationality fee for a template binding
   * Nationality must be unique within the binding
   */
  async create(
    bindingId: string,
    dto: CreateBindingNationalityFeeDto,
    actorUserId?: string,
  ): Promise<BindingNationalityFeeResponseDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id: bindingId, deletedAt: null },
    });

    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate nationality within binding
    const existingFee = await this.prisma.bindingNationalityFee.findFirst({
      where: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        deletedAt: null,
      },
    });

    if (existingFee) {
      throw new ConflictException('Nationality fee already exists', [
        {
          field: 'nationalityCountryId',
          reason: ErrorCodes.CONFLICT,
          message: 'A fee already exists for this nationality in this binding',
        },
      ]);
    }

    // Validate nationality country exists
    const nationalityCountry = await this.prisma.country.findFirst({
      where: { id: dto.nationalityCountryId, deletedAt: null },
    });

    if (!nationalityCountry) {
      throw new NotFoundException('Nationality country not found', [
        {
          reason: ErrorCodes.COUNTRY_NOT_FOUND,
          message: 'Nationality country does not exist or has been deleted',
        },
      ]);
    }

    const fee = await this.prisma.bindingNationalityFee.create({
      data: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.nationalityCountryId,
        governmentFeeAmount: new Decimal(dto.governmentFeeAmount),
        serviceFeeAmount: new Decimal(dto.serviceFeeAmount),
        expeditedFeeAmount: dto.expeditedFeeAmount ? new Decimal(dto.expeditedFeeAmount) : null,
        currencyCode: dto.currencyCode.toUpperCase(),
        expeditedEnabled: dto.expeditedEnabled ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'bindingNationalityFee.create',
        'BindingNationalityFee',
        fee.id,
        undefined,
        {
          templateBindingId: bindingId,
          nationalityCountryId: fee.nationalityCountryId,
          governmentFeeAmount: fee.governmentFeeAmount.toString(),
          serviceFeeAmount: fee.serviceFeeAmount.toString(),
          expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || null,
          currencyCode: fee.currencyCode,
          expeditedEnabled: fee.expeditedEnabled,
          isActive: fee.isActive,
        },
      );
    }

    this.logger.log(`Binding nationality fee created: ${fee.id} for binding: ${bindingId}`);
    return this.mapToResponse(fee);
  }

  /**
   * Update nationality fee
   */
  async update(
    feeId: string,
    dto: UpdateBindingNationalityFeeDto,
    actorUserId?: string,
  ): Promise<BindingNationalityFeeResponseDto> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Nationality fee does not exist or has been deleted',
        },
      ]);
    }

    // Check for duplicate if changing nationality
    if (dto.nationalityCountryId && dto.nationalityCountryId !== fee.nationalityCountryId) {
      const existingFee = await this.prisma.bindingNationalityFee.findFirst({
        where: {
          templateBindingId: fee.templateBindingId,
          nationalityCountryId: dto.nationalityCountryId,
          deletedAt: null,
          NOT: { id: feeId },
        },
      });

      if (existingFee) {
        throw new ConflictException('Nationality fee already exists', [
          {
            field: 'nationalityCountryId',
            reason: ErrorCodes.CONFLICT,
            message: 'A fee already exists for this nationality in this binding',
          },
        ]);
      }

      const nationalityCountry = await this.prisma.country.findFirst({
        where: { id: dto.nationalityCountryId, deletedAt: null },
      });

      if (!nationalityCountry) {
        throw new NotFoundException('Nationality country not found', [
          {
            reason: ErrorCodes.COUNTRY_NOT_FOUND,
            message: 'Nationality country does not exist or has been deleted',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.nationalityCountryId !== undefined)
      updateData.nationalityCountryId = dto.nationalityCountryId;
    if (dto.governmentFeeAmount !== undefined)
      updateData.governmentFeeAmount = new Decimal(dto.governmentFeeAmount);
    if (dto.serviceFeeAmount !== undefined)
      updateData.serviceFeeAmount = new Decimal(dto.serviceFeeAmount);
    if (dto.expeditedFeeAmount !== undefined) {
      updateData.expeditedFeeAmount = dto.expeditedFeeAmount
        ? new Decimal(dto.expeditedFeeAmount)
        : null;
    }
    if (dto.currencyCode !== undefined) updateData.currencyCode = dto.currencyCode.toUpperCase();
    if (dto.expeditedEnabled !== undefined) updateData.expeditedEnabled = dto.expeditedEnabled;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedFee = await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: updateData,
      include: {
        nationalityCountry: {
          select: { id: true, name: true, isoCode: true },
        },
      },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'bindingNationalityFee.update',
        'BindingNationalityFee',
        feeId,
        {
          governmentFeeAmount: fee.governmentFeeAmount.toString(),
          serviceFeeAmount: fee.serviceFeeAmount.toString(),
          expeditedFeeAmount: fee.expeditedFeeAmount?.toString() || null,
          currencyCode: fee.currencyCode,
          expeditedEnabled: fee.expeditedEnabled,
          isActive: fee.isActive,
        },
        {
          governmentFeeAmount: updatedFee.governmentFeeAmount.toString(),
          serviceFeeAmount: updatedFee.serviceFeeAmount.toString(),
          expeditedFeeAmount: updatedFee.expeditedFeeAmount?.toString() || null,
          currencyCode: updatedFee.currencyCode,
          expeditedEnabled: updatedFee.expeditedEnabled,
          isActive: updatedFee.isActive,
        },
      );
    }

    this.logger.log(`Binding nationality fee updated: ${feeId}`);
    return this.mapToResponse(updatedFee);
  }

  /**
   * Soft delete nationality fee
   */
  async delete(feeId: string, actorUserId?: string): Promise<void> {
    const fee = await this.prisma.bindingNationalityFee.findFirst({
      where: { id: feeId, deletedAt: null },
    });

    if (!fee) {
      throw new NotFoundException('Binding nationality fee not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: 'Nationality fee does not exist or has been deleted',
        },
      ]);
    }

    await this.prisma.bindingNationalityFee.update({
      where: { id: feeId },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'bindingNationalityFee.delete',
        'BindingNationalityFee',
        feeId,
        {
          templateBindingId: fee.templateBindingId,
          nationalityCountryId: fee.nationalityCountryId,
          governmentFeeAmount: fee.governmentFeeAmount.toString(),
          serviceFeeAmount: fee.serviceFeeAmount.toString(),
          currencyCode: fee.currencyCode,
        },
        undefined,
      );
    }

    this.logger.log(`Binding nationality fee soft deleted: ${feeId}`);
  }

  /**
   * Module 9 — copy one nationality's fee values onto a list of
   * target nationalities under the same binding. Atomic — all
   * creates + updates run inside one transaction so the binding
   * never lands in a half-applied state.
   *
   * `details` mirrors the per-target outcome so the UI can render a
   * "3 created, 1 updated, 2 skipped (already had a fee)" summary
   * and the admin understands exactly what happened.
   */
  async bulkCopy(
    bindingId: string,
    dto: BulkCopyFeesDto,
    actorUserId?: string,
  ): Promise<BulkCopyFeesResultDto> {
    const binding = await this.prisma.templateBinding.findFirst({
      where: { id: bindingId, deletedAt: null },
      select: { id: true },
    });
    if (!binding) {
      throw new NotFoundException('Template binding not found', [
        {
          reason: ErrorCodes.BINDING_NOT_FOUND,
          message: 'Template binding does not exist or has been deleted',
        },
      ]);
    }

    // Source row must already exist on this binding.
    const source = await this.prisma.bindingNationalityFee.findFirst({
      where: {
        templateBindingId: bindingId,
        nationalityCountryId: dto.sourceNationalityCountryId,
        deletedAt: null,
      },
    });
    if (!source) {
      throw new NotFoundException('Source fee not found on this binding', [
        {
          field: 'sourceNationalityCountryId',
          reason: ErrorCodes.NOT_FOUND,
          message:
            'Source nationality has no fee on this binding — create the source fee first.',
        },
      ]);
    }

    // Pre-fetch existing fees for all targets in one query to keep the
    // transaction tight (no N+1 inside the writer loop below).
    const existingTargets = await this.prisma.bindingNationalityFee.findMany({
      where: {
        templateBindingId: bindingId,
        nationalityCountryId: { in: dto.targetNationalityCountryIds },
        deletedAt: null,
      },
      select: { id: true, nationalityCountryId: true },
    });
    const existingByNationality = new Map(
      existingTargets.map((row) => [row.nationalityCountryId, row.id]),
    );

    const overwrite = dto.overwriteExisting === true;
    // Prisma's $transaction array overload requires PrismaPromise specifically
    // — typing the array as Promise<unknown>[] erases the brand and breaks
    // the call. We enqueue the un-awaited prisma calls (each is a
    // PrismaPromise) and let the transaction batch them.
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const details: BulkCopyFeesResultDto['details'] = [];

    // Materialize the source fee values once — Decimal payload is
    // identical for every target write.
    const valuesFromSource = {
      governmentFeeAmount: source.governmentFeeAmount,
      serviceFeeAmount: source.serviceFeeAmount,
      expeditedFeeAmount: source.expeditedFeeAmount,
      currencyCode: source.currencyCode,
      expeditedEnabled: source.expeditedEnabled,
      isActive: source.isActive,
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const targetId of dto.targetNationalityCountryIds) {
      // Copying a row onto itself is a no-op every time. Surface it
      // explicitly so the admin doesn't think their request silently
      // worked when in fact it did nothing meaningful.
      if (targetId === dto.sourceNationalityCountryId) {
        details.push({
          nationalityCountryId: targetId,
          outcome: 'skipped_self',
        });
        skipped += 1;
        continue;
      }

      const existingId = existingByNationality.get(targetId);
      if (existingId && !overwrite) {
        details.push({
          nationalityCountryId: targetId,
          outcome: 'skipped_exists',
        });
        skipped += 1;
        continue;
      }

      if (existingId && overwrite) {
        ops.push(
          this.prisma.bindingNationalityFee.update({
            where: { id: existingId },
            data: valuesFromSource,
          }),
        );
        details.push({
          nationalityCountryId: targetId,
          outcome: 'updated',
        });
        updated += 1;
      } else {
        ops.push(
          this.prisma.bindingNationalityFee.create({
            data: {
              templateBindingId: bindingId,
              nationalityCountryId: targetId,
              ...valuesFromSource,
            },
          }),
        );
        details.push({
          nationalityCountryId: targetId,
          outcome: 'created',
        });
        created += 1;
      }
    }

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'bindingNationalityFee.bulk_copy',
        'TemplateBinding',
        bindingId,
        undefined,
        {
          sourceNationalityCountryId: dto.sourceNationalityCountryId,
          targetCount: dto.targetNationalityCountryIds.length,
          overwriteExisting: overwrite,
          created,
          updated,
          skipped,
        },
      );
    }

    this.logger.log(
      `Bulk copy fees on ${bindingId}: created=${created}, updated=${updated}, skipped=${skipped}`,
    );

    return { created, updated, skipped, details };
  }

  private mapToResponse(fee: any): BindingNationalityFeeResponseDto {
    return {
      id: fee.id,
      templateBindingId: fee.templateBindingId,
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
    };
  }
}
