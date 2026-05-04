import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  RoleResponseDto,
  RoleListResponseDto,
  GetRolesQueryDto,
} from './dto';
import { NotFoundException, ConflictException, ForbiddenException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { isSystemRole } from '../accessControl/system-protection.constants';

/**
 * Module 6 — Roles service.
 *
 * System protection (Modul 6 D2 — all sharp):
 *   • System roles (superAdmin / admin / operator) cannot be deleted —
 *     existing rule, kept.
 *   • System role `key` cannot be renamed — runtime references to
 *     `superAdmin` etc. would silently break (PermissionsGuard,
 *     `isSuperAdminRole`, audit filters all key on the literal string).
 *   • POST endpoint forces `isSystem=false` — admins cannot mint new
 *     "system" roles via the API; system flag is only set by the seed.
 */
@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(query: GetRolesQueryDto): Promise<RoleListResponseDto> {
    const { page = 1, limit = 50, search, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };
    if (query.isSystem !== undefined) where.isSystem = query.isSystem;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { key: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          _count: { select: { users: { where: { deletedAt: null } } } },
        },
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.role.count({ where }),
    ]);

    const items = roles.map((role) => this.mapToResponse(role));

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    return this.mapToResponse(role);
  }

  /**
   * Create new role. `isSystem` from the DTO is ignored — admin cannot
   * mint system roles via the API; that flag is reserved for the seed.
   *
   * Module 6b — when `permissionIds` are provided, role + role-permission
   * rows are written in one transaction so a partial failure never
   * leaves an empty orphan role behind. Permission existence is
   * validated before the write so we fail fast with a 404 instead of
   * a Prisma FK error.
   *
   * Two audit entries are emitted on success:
   *   • `role.create` — name + key + description snapshot
   *   • `role.permissions.update` — the initial permission key set
   * Splitting these matches the matrix page edit flow (where
   * `role.permissions.update` is the only entry per save) so an audit
   * tail filtered on `role.permissions.update` shows all permission
   * changes uniformly regardless of whether they came from create or
   * subsequent edit.
   */
  async create(dto: CreateRoleDto, actorUserId?: string): Promise<RoleResponseDto> {
    const existingByKey = await this.prisma.role.findFirst({ where: { key: dto.key } });
    if (existingByKey) {
      throw new ConflictException('Role key already exists', [
        { field: 'key', reason: ErrorCodes.CONFLICT, message: 'A role with this key already exists' },
      ]);
    }

    const existingByName = await this.prisma.role.findFirst({ where: { name: dto.name } });
    if (existingByName) {
      throw new ConflictException('Role name already exists', [
        { field: 'name', reason: ErrorCodes.CONFLICT, message: 'A role with this name already exists' },
      ]);
    }

    // Pre-validate permission IDs (avoid partial create + FK error half-way).
    let permissionsToAssign: { id: string; permissionKey: string }[] = [];
    if (dto.permissionIds && dto.permissionIds.length > 0) {
      const found = await this.prisma.permission.findMany({
        where: { id: { in: dto.permissionIds } },
        select: { id: true, permissionKey: true },
      });
      if (found.length !== dto.permissionIds.length) {
        const foundIds = new Set(found.map((p) => p.id));
        const missing = dto.permissionIds.filter((id) => !foundIds.has(id));
        throw new NotFoundException('Some permissions not found', [
          {
            field: 'permissionIds',
            reason: ErrorCodes.NOT_FOUND,
            message: `Permission IDs not found: ${missing.join(', ')}`,
          },
        ]);
      }
      permissionsToAssign = found;
    }

    // Create role + assign permissions atomically. The include re-runs
    // after both writes commit so the response reflects the final state.
    const role = await this.prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name: dto.name,
          key: dto.key,
          description: dto.description,
          // Admin cannot mint system roles via the API — only the seed sets it.
          isSystem: false,
        },
      });
      if (permissionsToAssign.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionsToAssign.map((p) => ({
            roleId: created.id,
            permissionId: p.id,
          })),
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id: created.id },
        include: { _count: { select: { users: { where: { deletedAt: null } } } } },
      });
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.create',
        'Role',
        role.id,
        undefined,
        { key: role.key, name: role.name, description: role.description, isSystem: role.isSystem },
      );
      // Always emit the permissions.update entry — even when zero perms
      // were assigned — so the audit trail clearly shows initial state.
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.permissions.update',
        'Role',
        role.id,
        { permissionKeys: [], count: 0 },
        {
          permissionKeys: permissionsToAssign.map((p) => p.permissionKey).sort(),
          count: permissionsToAssign.length,
        },
      );
    }

    this.logger.log(
      `Role created: ${role.id} (${role.key}) with ${permissionsToAssign.length} permission(s)`,
    );
    return this.mapToResponse(role);
  }

  /**
   * Update role. System role `key` rename is blocked (would silently
   * break runtime references to `superAdmin` etc.). `name` and
   * `description` stay editable on system roles.
   */
  async update(id: string, dto: UpdateRoleDto, actorUserId?: string): Promise<RoleResponseDto> {
    const role = await this.prisma.role.findFirst({ where: { id, deletedAt: null } });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    // System role `key` rename guard.
    if (dto.key !== undefined && dto.key !== role.key && isSystemRole(role.key)) {
      throw new ConflictException('System role key is locked', [
        {
          field: 'key',
          reason: ErrorCodes.CONFLICT,
          message: `Role key "${role.key}" is referenced in code and cannot be renamed. You can still update the name and description.`,
        },
      ]);
    }

    if (dto.key && dto.key !== role.key) {
      const existingByKey = await this.prisma.role.findFirst({ where: { key: dto.key } });
      if (existingByKey) {
        throw new ConflictException('Role key already exists', [
          { field: 'key', reason: ErrorCodes.CONFLICT, message: 'A role with this key already exists' },
        ]);
      }
    }

    if (dto.name && dto.name !== role.name) {
      const existingByName = await this.prisma.role.findFirst({ where: { name: dto.name } });
      if (existingByName) {
        throw new ConflictException('Role name already exists', [
          { field: 'name', reason: ErrorCodes.CONFLICT, message: 'A role with this name already exists' },
        ]);
      }
    }

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.key) updateData.key = dto.key;
    if (dto.description !== undefined) updateData.description = dto.description;

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.update',
        'Role',
        id,
        { key: role.key, name: role.name, description: role.description },
        { key: updatedRole.key, name: updatedRole.name, description: updatedRole.description },
      );
    }

    this.logger.log(`Role updated: ${id}`);
    return this.mapToResponse(updatedRole);
  }

  /**
   * Soft delete role. System roles + roles with active users are
   * blocked (existing logic, now with audit logging).
   */
  async delete(id: string, actorUserId?: string): Promise<void> {
    const role = await this.prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { users: { where: { deletedAt: null } } } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system role', [
        { reason: ErrorCodes.FORBIDDEN, message: 'System roles cannot be deleted' },
      ]);
    }

    if (role._count.users > 0) {
      throw new ConflictException('Role has active users', [
        {
          reason: ErrorCodes.CONFLICT,
          message: `Cannot delete role with ${role._count.users} active user(s). Reassign users first.`,
        },
      ]);
    }

    await this.prisma.role.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.delete',
        'Role',
        id,
        { key: role.key, name: role.name, description: role.description, isSystem: role.isSystem },
        undefined,
      );
    }

    this.logger.log(`Role soft deleted: ${id}`);
  }

  private mapToResponse(role: any): RoleResponseDto {
    return {
      id: role.id,
      name: role.name,
      key: role.key,
      description: role.description || undefined,
      isSystem: role.isSystem,
      userCount: role._count?.users ?? 0,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };
  }
}
