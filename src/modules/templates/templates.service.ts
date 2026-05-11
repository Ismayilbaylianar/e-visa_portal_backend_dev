import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  TemplateResponseDto,
  TemplateListItemResponseDto,
  GetTemplatesQueryDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { PaginationMeta } from '@/common/types';
import { Prisma } from '@prisma/client';
import {
  SYSTEM_DEFAULT_FIELDS,
  SystemFieldSpec,
} from './system-default-fields';

/**
 * Template Builder service.
 *
 * Audit: every mutation emits a `template.{create,update,delete,duplicate}`
 * lowercase.dot key (Module 6a convention). Section + field reordering
 * emits `template.section.reorder` / `template.field.reorder` from
 * separate services — kept here only for the template-level lifecycle.
 *
 * `duplicate()` deep-clones a template plus all sections + fields in a
 * single transaction so partial failures (e.g. duplicate key on the
 * second section) roll back the whole tree.
 */
@Injectable()
export class TemplatesService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TemplatesService.name);

  /**
   * M11.13 (BUG Y) — On every backend start, re-run
   * `initializeSystemFields` against every non-boilerplate
   * template. The helper is idempotent (matches existing sections
   * by key, existing fields by systemKey OR fieldKey) so it only
   * INSERTS missing rows — admin renames + custom field reorders
   * survive untouched.
   *
   * This is how new entries added to `SYSTEM_DEFAULT_FIELDS`
   * (contactEmail / contactPhone / passportPhoto in this sprint)
   * make their way into templates that were created before those
   * specs existed. Boilerplates are skipped per the M11.3
   * boilerplate convention.
   *
   * Best-effort: a single template's backfill failure logs + moves
   * on rather than blocking app startup.
   */
  async onApplicationBootstrap(): Promise<void> {
    const env = process.env.NODE_ENV;
    // Skip during tests so jest doesn't have to mock prisma.
    if (env === 'test') return;
    try {
      const templates = await this.prisma.template.findMany({
        where: { deletedAt: null, isBoilerplate: false },
        select: { id: true, name: true },
      });
      let added = 0;
      let reconciled = 0;
      let touchedTemplates = 0;
      for (const t of templates) {
        try {
          const result = await this.prisma.$transaction((tx) =>
            this.initializeSystemFields(tx, t.id),
          );
          if (
            result.sectionsCreated > 0 ||
            result.fieldsCreated > 0 ||
            result.fieldsReconciled > 0
          ) {
            touchedTemplates++;
            added += result.fieldsCreated;
            reconciled += result.fieldsReconciled;
            this.logger.log(
              `[BUG Y/LL/MM] Template "${t.name}" (${t.id}): +${result.sectionsCreated} section(s), +${result.fieldsCreated} new field(s), ~${result.fieldsReconciled} reconciled field(s)`,
            );
          }
        } catch (err) {
          this.logger.error(
            `[BUG Y] Backfill failed for template ${t.id}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
      this.logger.log(
        `[BUG Y/LL/MM] System-field bootstrap complete: scanned ${templates.length} template(s), touched ${touchedTemplates}, added ${added} field(s), reconciled ${reconciled} field(s).`,
      );
    } catch (err) {
      this.logger.error(
        `[BUG Y] Bootstrap system-field backfill aborted: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Get paginated list of templates (summary view without deeply nested data)
   */
  async findAll(
    query: GetTemplatesQueryDto,
  ): Promise<{ items: TemplateListItemResponseDto[]; pagination: PaginationMeta }> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.isBoilerplate !== undefined && { isBoilerplate: query.isBoilerplate }),
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
          _count: {
            select: {
              sections: {
                where: { deletedAt: null },
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

    const items = templates.map(template => this.mapToListItemResponse(template));

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
   * Get template by ID with full nested structure (sections and fields)
   */
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
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    return this.mapToResponse(template);
  }

  /**
   * Create a new template.
   *
   * M11.3 — blank new templates auto-provision the 8 SYSTEM_DEFAULT_FIELDS
   * (Personal · Passport · Travel) so admins don't ship empty forms.
   * Boilerplates skip this — they have curated fields from M11.2.
   * Cloning skips it too (the duplicate path copies the source's
   * existing fields verbatim, which already include any system fields).
   */
  async create(dto: CreateTemplateDto, actorUserId?: string): Promise<TemplateResponseDto> {
    const existingByKey = await this.prisma.template.findUnique({
      where: { key: dto.key },
    });

    if (existingByKey) {
      throw new ConflictException('Template key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A template with this key already exists',
        },
      ]);
    }

    const isBoilerplate = (dto as { isBoilerplate?: boolean }).isBoilerplate ?? false;
    const shouldAutoProvisionSystemFields = !isBoilerplate;

    // Wrap create + system-field provisioning in a single transaction
    // so a partial failure (e.g. duplicate fieldKey collision) rolls
    // back the empty template too — admin retries from a clean slate.
    const templateId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          name: dto.name,
          key: dto.key,
          description: dto.description,
          version: 1,
          isActive: dto.isActive ?? true,
          isBoilerplate,
        },
      });
      if (shouldAutoProvisionSystemFields) {
        await this.initializeSystemFields(tx, created.id);
      }
      return created.id;
    });

    const template = await this.prisma.template.findFirstOrThrow({
      where: { id: templateId },
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.create',
        'Template',
        template.id,
        undefined,
        {
          key: template.key,
          name: template.name,
          version: template.version,
          isActive: template.isActive,
          isBoilerplate,
          systemFieldsAdded: shouldAutoProvisionSystemFields
            ? SYSTEM_DEFAULT_FIELDS.length
            : 0,
        },
      );
    }

    this.logger.log(
      `Template created: ${template.id} (${template.key})${shouldAutoProvisionSystemFields ? ` + ${SYSTEM_DEFAULT_FIELDS.length} system fields` : ''}`,
    );
    return this.mapToResponse(template);
  }

  /**
   * Provision SYSTEM_DEFAULT_FIELDS into a template within an existing
   * transaction. Idempotent on the structural side: skips sections +
   * fields that already exist (matched by section.key for sections
   * and field.systemKey for fields). Reused by both `create()` (blank
   * new template) and the M11.3 backfill
   * (`backfillSystemFieldsIntoExistingTemplate`).
   *
   * M11.14 (BUG LL + BUG MM) — also reconciles two attributes on
   * EXISTING system fields so admins automatically pick up:
   *   • `sortOrder` changes in the spec (e.g. nationality moving to
   *     the bottom of Personal Information)
   *   • `optionsJson` on system option-fields that started life with
   *     an empty array (e.g. the gender field added in this sprint —
   *     when the row already exists but has no options yet, hydrate
   *     them from the spec so customers see Male/Female/Other).
   *
   * What we DON'T overwrite: label / placeholder / helpText / isRequired
   * / visibilityRulesJson — those are admin-editable per template and
   * must survive a bootstrap pass. `optionsJson` is also left alone
   * the moment it has any entries (admin may have customized them).
   */
  async initializeSystemFields(
    tx: Prisma.TransactionClient,
    templateId: string,
  ): Promise<{
    sectionsCreated: number;
    fieldsCreated: number;
    fieldsReconciled: number;
  }> {
    // Group specs by section identity. We use sortOrder + slugified
    // title as the section key so re-running on a partially-seeded
    // template lands on the same sections rather than spawning
    // duplicates.
    type SectionGroup = {
      sectionKey: string;
      title: string;
      description?: string;
      sortOrder: number;
      fields: SystemFieldSpec['field'][];
    };
    const groups = new Map<string, SectionGroup>();
    for (const spec of SYSTEM_DEFAULT_FIELDS) {
      const sectionKey = sectionKeyFor(spec.sectionTitle);
      const groupKey = `${spec.sectionOrder}_${sectionKey}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          sectionKey,
          title: spec.sectionTitle,
          description: spec.sectionDescription,
          sortOrder: spec.sectionOrder,
          fields: [],
        });
      }
      groups.get(groupKey)!.fields.push(spec.field);
    }

    let sectionsCreated = 0;
    let fieldsCreated = 0;
    let fieldsReconciled = 0;

    for (const group of groups.values()) {
      // Look up by (templateId, sectionKey) — the unique index there
      // means we either find the existing section or create a fresh
      // one. We never overwrite an existing section's metadata so
      // admin renames survive a re-run.
      let section = await tx.templateSection.findFirst({
        where: {
          templateId,
          key: group.sectionKey,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!section) {
        const fresh = await tx.templateSection.create({
          data: {
            templateId,
            title: group.title,
            key: group.sectionKey,
            description: group.description,
            sortOrder: group.sortOrder,
            isActive: true,
          },
          select: { id: true },
        });
        section = fresh;
        sectionsCreated++;
      }

      for (const fieldSpec of group.fields) {
        // Skip if this systemKey OR a manually-created field with the
        // same fieldKey already exists anywhere on the template.
        // M11.7 (D3): the original lookup only matched on systemKey,
        // which left a P2002 surface when an admin had manually added
        // a field with `fieldKey === systemKey` before this template
        // was backfilled. We now check both columns and absorb the
        // unique violation as a final safety net so the whole backfill
        // never aborts mid-run on a single template.
        const existing = await tx.templateField.findFirst({
          where: {
            OR: [{ systemKey: fieldSpec.systemKey }, { fieldKey: fieldSpec.systemKey }],
            templateSection: { templateId, deletedAt: null },
            deletedAt: null,
          },
          select: {
            id: true,
            sortOrder: true,
            optionsJson: true,
            isSystem: true,
          },
        });
        if (existing) {
          // M11.14 (BUG LL + MM) — reconcile attributes that should
          // track the spec on every restart. We deliberately limit
          // ourselves to two:
          //   1. sortOrder if the row drifted from the spec
          //   2. optionsJson if the spec has options AND the row is
          //      still on the original empty default (`[]`). Once an
          //      admin has saved any options of their own (or removed
          //      one), we treat the row as customized and stop here.
          const updates: Prisma.TemplateFieldUpdateInput = {};
          if (existing.sortOrder !== fieldSpec.sortOrder) {
            updates.sortOrder = fieldSpec.sortOrder;
          }
          if (
            fieldSpec.optionsJson &&
            fieldSpec.optionsJson.length > 0 &&
            Array.isArray(existing.optionsJson) &&
            existing.optionsJson.length === 0
          ) {
            updates.optionsJson =
              fieldSpec.optionsJson as unknown as Prisma.InputJsonValue;
          }
          if (Object.keys(updates).length > 0) {
            await tx.templateField.update({
              where: { id: existing.id },
              data: updates,
            });
            fieldsReconciled++;
          }
          continue;
        }

        try {
          await tx.templateField.create({
            data: {
              templateSectionId: section.id,
              // fieldKey mirrors systemKey on system fields so legacy
              // consumers that read fieldKey keep working.
              fieldKey: fieldSpec.systemKey,
              systemKey: fieldSpec.systemKey,
              isSystem: true,
              fieldType: fieldSpec.fieldType,
              label: fieldSpec.label,
              placeholder: fieldSpec.placeholder ?? null,
              helpText: fieldSpec.helpText ?? null,
              isRequired: fieldSpec.isRequired,
              sortOrder: fieldSpec.sortOrder,
              isActive: true,
              // M11.14 (BUG MM) — option fields (e.g. gender) seed
              // their canonical option list from the spec so customers
              // see real choices the moment the field appears.
              optionsJson: (fieldSpec.optionsJson ??
                []) as unknown as Prisma.InputJsonValue,
              validationRulesJson: fieldSpec.validationRulesJson as Prisma.InputJsonValue,
              visibilityRulesJson: [],
            },
          });
          fieldsCreated++;
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            // Race or stale index hit — log and continue so a single
            // duplicate doesn't take the whole backfill down.
            console.warn(
              `[backfill] Skipping system field '${fieldSpec.systemKey}' on template ${templateId}: P2002 unique violation (already exists)`,
            );
            continue;
          }
          throw err;
        }
      }
    }

    return { sectionsCreated, fieldsCreated, fieldsReconciled };
  }

  /**
   * M11.3 — backfill helper. Public wrapper around
   * `initializeSystemFields` so the seed (or a one-off admin task)
   * can backfill an existing non-boilerplate template without going
   * through the create flow. Skips boilerplates by default.
   */
  async backfillSystemFieldsIntoExistingTemplate(
    templateId: string,
  ): Promise<{ sectionsCreated: number; fieldsCreated: number; skipped: boolean }> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
      select: { id: true, isBoilerplate: true },
    });
    if (!template) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Template not found' },
      ]);
    }
    if (template.isBoilerplate) {
      return { sectionsCreated: 0, fieldsCreated: 0, skipped: true };
    }
    const result = await this.prisma.$transaction((tx) =>
      this.initializeSystemFields(tx, templateId),
    );
    return { ...result, skipped: false };
  }

  /**
   * Duplicate a template — deep clones the template, all its sections,
   * and all their fields in a single transaction. The new template
   * starts at version 1 (independent lifecycle from the source).
   *
   * Bindings, applications, and audit history are NOT copied —
   * duplicates are content-only.
   */
  async duplicate(
    sourceId: string,
    dto: { name: string; key: string; description?: string },
    actorUserId?: string,
  ): Promise<TemplateResponseDto> {
    const source = await this.prisma.template.findFirst({
      where: { id: sourceId, deletedAt: null },
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

    if (!source) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Source template does not exist' },
      ]);
    }

    const existingByKey = await this.prisma.template.findUnique({ where: { key: dto.key } });
    if (existingByKey) {
      throw new ConflictException('Template key already exists', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: 'A template with this key already exists',
        },
      ]);
    }

    // Single transaction: create template → fan out sections → fan out
    // fields per section. Any partial failure rolls back the entire tree.
    const newTemplate = await this.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          name: dto.name,
          key: dto.key,
          description: dto.description ?? source.description,
          version: 1,
          isActive: true,
        },
      });

      for (const section of source.sections) {
        const newSection = await tx.templateSection.create({
          data: {
            templateId: created.id,
            title: section.title,
            key: section.key,
            description: section.description,
            sortOrder: section.sortOrder,
            isActive: section.isActive,
          },
        });

        if (section.fields.length > 0) {
          await tx.templateField.createMany({
            data: section.fields.map((f) => ({
              templateSectionId: newSection.id,
              fieldKey: f.fieldKey,
              fieldType: f.fieldType,
              label: f.label,
              placeholder: f.placeholder,
              helpText: f.helpText,
              defaultValue: f.defaultValue,
              isRequired: f.isRequired,
              sortOrder: f.sortOrder,
              isActive: f.isActive,
              optionsJson: f.optionsJson ?? undefined,
              validationRulesJson: f.validationRulesJson ?? undefined,
              visibilityRulesJson: f.visibilityRulesJson ?? undefined,
            })),
          });
        }
      }

      return created;
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.duplicate',
        'Template',
        newTemplate.id,
        { sourceId: source.id, sourceKey: source.key },
        { newId: newTemplate.id, newKey: newTemplate.key, name: newTemplate.name },
      );
    }

    this.logger.log(`Template duplicated: ${source.id} → ${newTemplate.id} (${newTemplate.key})`);
    return this.findById(newTemplate.id);
  }

  /**
   * Update template
   * Note: Version is not auto-incremented in this stage. Manual version management if needed.
   */
  async update(
    id: string,
    dto: UpdateTemplateDto,
    actorUserId?: string,
  ): Promise<TemplateResponseDto> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    if (dto.key && dto.key !== template.key) {
      const existingByKey = await this.prisma.template.findUnique({
        where: { key: dto.key },
      });
      if (existingByKey) {
        throw new ConflictException('Template key already exists', [
          {
            field: 'key',
            reason: ErrorCodes.CONFLICT,
            message: 'A template with this key already exists',
          },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.key !== undefined) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedTemplate = await this.prisma.template.update({
      where: { id },
      data: updateData,
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

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.update',
        'Template',
        id,
        { name: template.name, key: template.key, description: template.description, isActive: template.isActive },
        {
          name: updatedTemplate.name,
          key: updatedTemplate.key,
          description: updatedTemplate.description,
          isActive: updatedTemplate.isActive,
        },
      );
    }

    this.logger.log(`Template updated: ${id}`);
    return this.mapToResponse(updatedTemplate);
  }

  /**
   * Soft delete template and all its sections and fields
   */
  async delete(id: string, actorUserId?: string, force = false): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        {
          reason: ErrorCodes.TEMPLATE_NOT_FOUND,
          message: 'Template does not exist or has been deleted',
        },
      ]);
    }

    // M11.14 (BUG AA) — Cascade-aware delete.
    //
    // Before this fix, soft-deleting a template left active
    // `template_bindings` (and their `binding_nationality_fees`)
    // pointing at it — admins saw "orphan" bindings in
    // /admin/template-bindings that referenced a deleted template.
    //
    // New behavior:
    //   - If active bindings exist AND !force → 409 with a
    //     count so the frontend can ask "delete X bindings too?"
    //   - If force=true → cascade-soft-delete the bindings AND
    //     their nationality fees in the same transaction.
    const activeBindings = await this.prisma.templateBinding.findMany({
      where: { templateId: id, deletedAt: null },
      select: { id: true },
    });

    if (activeBindings.length > 0 && !force) {
      throw new ConflictException(
        `Cannot delete: template has ${activeBindings.length} active binding(s)`,
        [
          {
            reason: ErrorCodes.CONFLICT,
            field: 'bindings',
            message: `Delete or migrate the ${activeBindings.length} binding(s) first, or call this endpoint with ?force=true to cascade-delete them.`,
          },
        ],
      );
    }

    const now = new Date();
    const sectionIds = template.sections.map(s => s.id);
    const bindingIds = activeBindings.map(b => b.id);

    await this.prisma.$transaction([
      // Cascade soft-delete bindings + their nationality fees when
      // force=true. updateMany is no-op when bindingIds is empty.
      ...(bindingIds.length > 0
        ? [
            this.prisma.bindingNationalityFee.updateMany({
              where: { templateBindingId: { in: bindingIds }, deletedAt: null },
              data: { deletedAt: now },
            }),
            this.prisma.templateBinding.updateMany({
              where: { id: { in: bindingIds }, deletedAt: null },
              data: { deletedAt: now },
            }),
          ]
        : []),
      // Soft delete all fields in all sections
      ...(sectionIds.length > 0
        ? [
            this.prisma.templateField.updateMany({
              where: { templateSectionId: { in: sectionIds }, deletedAt: null },
              data: { deletedAt: now },
            }),
          ]
        : []),
      // Soft delete all sections
      this.prisma.templateSection.updateMany({
        where: { templateId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      // Soft delete template
      this.prisma.template.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.delete',
        'Template',
        id,
        {
          key: template.key,
          name: template.name,
          version: template.version,
          sectionCount: sectionIds.length,
        },
        {
          force,
          cascadedBindings: bindingIds.length,
        },
      );
    }

    this.logger.log(
      `[BUG AA] Template soft deleted: ${id} (sections=${sectionIds.length}, bindings_cascaded=${bindingIds.length}, force=${force})`,
    );
  }

  /**
   * Section reorder — bulk update sortOrder for sections under one
   * template in a single transaction. Validates that every id belongs
   * to the template before applying changes.
   */
  async reorderSections(
    templateId: string,
    orderedIds: string[],
    actorUserId?: string,
  ): Promise<void> {
    const template = await this.prisma.template.findFirst({
      where: { id: templateId, deletedAt: null },
      include: {
        sections: { where: { deletedAt: null }, select: { id: true } },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found', [
        { reason: ErrorCodes.TEMPLATE_NOT_FOUND, message: 'Template does not exist' },
      ]);
    }

    const knownIds = new Set(template.sections.map((s) => s.id));
    const unknown = orderedIds.filter((id) => !knownIds.has(id));
    if (unknown.length > 0) {
      throw new ConflictException('Reorder rejected', [
        {
          field: 'orderedIds',
          reason: ErrorCodes.CONFLICT,
          message: `Sections do not belong to this template: ${unknown.join(', ')}`,
        },
      ]);
    }

    if (orderedIds.length !== template.sections.length) {
      throw new ConflictException('Reorder rejected', [
        {
          field: 'orderedIds',
          reason: ErrorCodes.CONFLICT,
          message: `Expected ${template.sections.length} section ids, received ${orderedIds.length}`,
        },
      ]);
    }

    const beforeOrder = template.sections.map((s) => s.id);

    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.templateSection.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'template.section.reorder',
        'Template',
        templateId,
        { order: beforeOrder },
        { order: orderedIds },
      );
    }

    this.logger.log(`Template sections reordered: ${templateId} (${orderedIds.length} sections)`);
  }

  /**
   * Map template to list item response (summary without nested data)
   */
  private mapToListItemResponse(template: any): TemplateListItemResponseDto {
    return {
      id: template.id,
      name: template.name,
      key: template.key,
      description: template.description || undefined,
      version: template.version,
      isActive: template.isActive,
      sectionsCount: template._count?.sections ?? 0,
      isBoilerplate: template.isBoilerplate ?? false,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  /**
   * Map template to full response with nested sections and fields
   */
  private mapToResponse(template: any): TemplateResponseDto {
    return {
      id: template.id,
      name: template.name,
      key: template.key,
      description: template.description || undefined,
      version: template.version,
      isActive: template.isActive,
      isBoilerplate: template.isBoilerplate ?? false,
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
          optionsJson: field.optionsJson ?? [],
          validationRulesJson: field.validationRulesJson ?? null,
          visibilityRulesJson: field.visibilityRulesJson ?? [],
          // M11.3 — surface lock state to admin UIs.
          isSystem: field.isSystem ?? false,
          systemKey: field.systemKey ?? null,
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

/**
 * M11.3 — slugify a section title into the canonical section.key
 * used by SYSTEM_DEFAULT_FIELDS provisioning. Lowercase, spaces +
 * non-alnum collapse to underscores. Stable across re-runs so the
 * idempotent backfill matches existing seeded sections.
 */
function sectionKeyFor(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
