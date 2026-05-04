import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from '../auditLogs/audit-logs.service';
import { PermissionEffect } from '@prisma/client';
import {
  PermissionResponseDto,
  PermissionListResponseDto,
  PermissionMatrixResponseDto,
  PermissionModuleDto,
  RolePermissionMatrixDto,
  UpdateRolePermissionsDto,
  UpdateRolePermissionsResponseDto,
  UpdateUserPermissionsDto,
  UpdateUserPermissionsResponseDto,
  UserEffectivePermissionsResponseDto,
  UserEffectivePermissionDto,
} from './dto';
import { NotFoundException, ConflictException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';
import { isSuperAdminRole } from '../accessControl/system-protection.constants';

// Module display names for the matrix view
const MODULE_NAMES: Record<string, string> = {
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  sessions: 'Sessions',
  countries: 'Countries',
  countryPages: 'Country Pages',
  visaTypes: 'Visa Types',
  templates: 'Templates',
  templateBindings: 'Template Bindings',
  applications: 'Applications',
  payments: 'Payments',
  notifications: 'Notifications',
  settings: 'Settings',
  emailTemplates: 'Email Templates',
  paymentPageConfigs: 'Payment Page Configs',
  auditLogs: 'Audit Logs',
  jobs: 'Jobs',
  dashboard: 'Dashboard',
};

/**
 * Module 6 — Permissions service.
 *
 * System protection (Modul 6 D2):
 *   • Super-admin role permission set is locked. Stripping permissions
 *     from `superAdmin` would silently break the org and there's no
 *     legitimate workflow that needs it (super admin = god-mode by
 *     design; the seed defines the canonical full set).
 *   • Super-admin user permission overrides are locked. A `DENY` on a
 *     super admin would silently revoke god-mode without UI feedback.
 *
 * Audit: every change emits a `role.permissions.update` or
 * `user.permissions.update` entry with full before/after permission key
 * lists — these are the most sensitive operations in the system.
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Get all permissions
   */
  async findAll(): Promise<PermissionListResponseDto> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    const items: PermissionResponseDto[] = permissions.map((p) => ({
      id: p.id,
      moduleKey: p.moduleKey,
      actionKey: p.actionKey,
      permissionKey: p.permissionKey,
      description: p.description || undefined,
      createdAt: p.createdAt,
    }));

    return { items, total: items.length };
  }

  /**
   * Get permission matrix (grouped by module with role assignments).
   * Used by the Modul 6b role permission matrix UI.
   */
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { name: 'asc' },
    });

    const moduleMap = new Map<string, PermissionModuleDto>();

    for (const perm of permissions) {
      if (!moduleMap.has(perm.moduleKey)) {
        moduleMap.set(perm.moduleKey, {
          moduleKey: perm.moduleKey,
          moduleName: MODULE_NAMES[perm.moduleKey] || perm.moduleKey,
          permissions: [],
        });
      }

      moduleMap.get(perm.moduleKey)!.permissions.push({
        id: perm.id,
        actionKey: perm.actionKey,
        permissionKey: perm.permissionKey,
        description: perm.description || '',
      });
    }

    const roleMatrix: RolePermissionMatrixDto[] = roles.map((role) => ({
      roleId: role.id,
      roleName: role.name,
      roleKey: role.key,
      permissionIds: role.rolePermissions.map((rp) => rp.permissionId),
    }));

    return {
      modules: Array.from(moduleMap.values()),
      roles: roleMatrix,
    };
  }

  /**
   * Get effective permissions for a user — per-permission rows showing
   * role contribution + user override + final effective state. Powers
   * the Modul 6b granular override matrix UI.
   */
  async getUserEffectivePermissions(
    userId: string,
  ): Promise<UserEffectivePermissionsResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: { include: { rolePermissions: true } },
        userPermissions: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    const allPermissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    const rolePermIds = new Set(user.role?.rolePermissions.map((rp) => rp.permissionId) ?? []);
    const overridesById = new Map<string, PermissionEffect>(
      user.userPermissions.map((up) => [up.permissionId, up.effect]),
    );

    const rows: UserEffectivePermissionDto[] = allPermissions.map((p) => {
      const fromRole = rolePermIds.has(p.id);
      const override = (overridesById.get(p.id) ?? null) as 'ALLOW' | 'DENY' | null;
      let effective: boolean;
      if (override === 'ALLOW') effective = true;
      else if (override === 'DENY') effective = false;
      else effective = fromRole;

      return {
        permissionId: p.id,
        moduleKey: p.moduleKey,
        actionKey: p.actionKey,
        permissionKey: p.permissionKey,
        description: p.description ?? undefined,
        fromRole,
        override,
        effective,
      };
    });

    return {
      userId: user.id,
      roleId: user.roleId ?? undefined,
      roleKey: user.role?.key ?? undefined,
      permissions: rows,
    };
  }

  /**
   * Update role permissions (replaces existing).
   * Super-admin role permission set is locked.
   */
  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
    actorUserId?: string,
  ): Promise<UpdateRolePermissionsResponseDto> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
      include: { rolePermissions: { include: { permission: true } } },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    if (isSuperAdminRole(role.key)) {
      throw new ConflictException('Super-admin role permission set is locked', [
        {
          field: 'roleId',
          reason: ErrorCodes.CONFLICT,
          message:
            'Permissions for the super admin role are locked. Stripping any permission would silently break god-mode and lock the org out of UAM controls.',
        },
      ]);
    }

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      const foundIds = permissions.map((p) => p.id);
      const missingIds = dto.permissionIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException('Some permissions not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: `Permission IDs not found: ${missingIds.join(', ')}`,
        },
      ]);
    }

    const beforeKeys = role.rolePermissions.map((rp) => rp.permission.permissionKey).sort();
    const afterKeys = permissions.map((p) => p.permissionKey).sort();

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({ roleId, permissionId })),
      }),
    ]);

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'role.permissions.update',
        'Role',
        roleId,
        { permissionKeys: beforeKeys, count: beforeKeys.length },
        { permissionKeys: afterKeys, count: afterKeys.length },
      );
    }

    this.logger.log(
      `Updated permissions for role ${roleId}: ${beforeKeys.length} → ${afterKeys.length}`,
    );

    return {
      roleId,
      permissionCount: permissions.length,
      permissionKeys: afterKeys,
    };
  }

  /**
   * Module 6b — orphan permission cleanup.
   *
   * Hard-delete a permission row from the system. Designed to remove
   * dead permission keys that exist in the DB but are no longer used by
   * any code path (the M1 audit flagged `countries.create` and
   * `countries.delete` as phantoms — Country is reference data, those
   * actions never fire).
   *
   * Safety guards:
   *   • Block when ANY role still references the permission (the admin
   *     should strip it from roles first, then delete). 409 with the
   *     count + list of role keys so the admin can locate them.
   *   • Block when ANY user override references the permission. Same
   *     reasoning.
   *
   * No soft-delete — Permission has no `deletedAt` column; this is a
   * hard delete. PermissionEffect-typed UserPermission rows would
   * cascade-error if we left them around, so the `userPermission`
   * guard above is mandatory, not optional.
   *
   * Audit: `permission.delete` with the deleted key + module/action so
   * the audit feed clearly shows what's gone.
   */
  async deletePermission(
    permissionId: string,
    actorUserId?: string,
  ): Promise<{ deletedKey: string }> {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
    });
    if (!permission) {
      throw new NotFoundException('Permission not found', [
        { reason: ErrorCodes.NOT_FOUND, message: 'Permission does not exist' },
      ]);
    }

    // Guard: blocked if assigned to any role.
    const roleAssignments = await this.prisma.rolePermission.findMany({
      where: { permissionId },
      include: { role: { select: { key: true } } },
    });
    if (roleAssignments.length > 0) {
      const roleKeys = roleAssignments.map((rp) => rp.role.key).sort();
      throw new ConflictException('Permission is assigned to roles', [
        {
          field: 'permissionId',
          reason: ErrorCodes.CONFLICT,
          message: `Permission "${permission.permissionKey}" is still assigned to ${roleAssignments.length} role(s): ${roleKeys.join(', ')}. Strip it from those roles first.`,
        },
      ]);
    }

    // Guard: blocked if any user override references it.
    const overrideCount = await this.prisma.userPermission.count({
      where: { permissionId },
    });
    if (overrideCount > 0) {
      throw new ConflictException('Permission has user overrides', [
        {
          field: 'permissionId',
          reason: ErrorCodes.CONFLICT,
          message: `Permission "${permission.permissionKey}" still has ${overrideCount} user override(s). Clear them first.`,
        },
      ]);
    }

    await this.prisma.permission.delete({ where: { id: permissionId } });

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'permission.delete',
        'Permission',
        permissionId,
        {
          permissionKey: permission.permissionKey,
          moduleKey: permission.moduleKey,
          actionKey: permission.actionKey,
          description: permission.description,
        },
        undefined,
      );
    }

    this.logger.log(
      `Permission deleted: ${permissionId} (${permission.permissionKey}) by user ${actorUserId ?? '<system>'}`,
    );
    return { deletedKey: permission.permissionKey };
  }

  /**
   * Update user permission overrides.
   * Super-admin user overrides are locked (DENY on god-mode is dangerous).
   */
  async updateUserPermissions(
    userId: string,
    dto: UpdateUserPermissionsDto,
    actorUserId?: string,
  ): Promise<UpdateUserPermissionsResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        role: true,
        userPermissions: { include: { permission: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    if (isSuperAdminRole(user.role?.key)) {
      throw new ConflictException('Super-admin user overrides are locked', [
        {
          field: 'userId',
          reason: ErrorCodes.CONFLICT,
          message:
            'Permission overrides for super admin users are locked. A DENY would silently strip god-mode without an obvious UI signal.',
        },
      ]);
    }

    const allPermissionIds = [...(dto.grants || []), ...(dto.denies || [])];

    if (allPermissionIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: { id: { in: allPermissionIds } },
      });

      if (permissions.length !== allPermissionIds.length) {
        const foundIds = permissions.map((p) => p.id);
        const missingIds = allPermissionIds.filter((id) => !foundIds.includes(id));
        throw new NotFoundException('Some permissions not found', [
          {
            reason: ErrorCodes.NOT_FOUND,
            message: `Permission IDs not found: ${missingIds.join(', ')}`,
          },
        ]);
      }
    }

    const beforeOverrides = user.userPermissions.map((up) => ({
      permissionKey: up.permission.permissionKey,
      effect: up.effect as 'ALLOW' | 'DENY',
    }));

    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });

      const createData: { userId: string; permissionId: string; effect: 'ALLOW' | 'DENY' }[] = [];

      for (const permId of dto.grants || []) {
        createData.push({ userId, permissionId: permId, effect: 'ALLOW' });
      }
      for (const permId of dto.denies || []) {
        createData.push({ userId, permissionId: permId, effect: 'DENY' });
      }

      if (createData.length > 0) {
        await tx.userPermission.createMany({ data: createData });
      }
    });

    const userPermissions = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    const afterOverrides = userPermissions.map((up) => ({
      permissionKey: up.permission.permissionKey,
      effect: up.effect as 'ALLOW' | 'DENY',
    }));

    if (actorUserId) {
      await this.auditLogsService.logAdminAction(
        actorUserId,
        'user.permissions.update',
        'User',
        userId,
        { overrides: beforeOverrides, count: beforeOverrides.length },
        { overrides: afterOverrides, count: afterOverrides.length },
      );
    }

    this.logger.log(
      `Updated permission overrides for user ${userId}: ${beforeOverrides.length} → ${afterOverrides.length}`,
    );

    return {
      userId,
      overrides: userPermissions.map((up) => ({
        permissionId: up.permissionId,
        permissionKey: up.permission.permissionKey,
        effect: up.effect,
      })),
    };
  }
}
