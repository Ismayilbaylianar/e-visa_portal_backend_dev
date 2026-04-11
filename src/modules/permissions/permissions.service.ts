import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
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
} from './dto';
import { NotFoundException } from '@/common/exceptions';
import { ErrorCodes } from '@/common/constants';

// Module display names for the matrix view
const MODULE_NAMES: Record<string, string> = {
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  sessions: 'Sessions',
  countries: 'Countries',
  visaTypes: 'Visa Types',
  templates: 'Templates',
  applications: 'Applications',
  payments: 'Payments',
  settings: 'Settings',
  auditLogs: 'Audit Logs',
  jobs: 'Jobs',
  dashboard: 'Dashboard',
};

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions
   */
  async findAll(): Promise<PermissionListResponseDto> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    const items: PermissionResponseDto[] = permissions.map(p => ({
      id: p.id,
      moduleKey: p.moduleKey,
      actionKey: p.actionKey,
      permissionKey: p.permissionKey,
      description: p.description || undefined,
      createdAt: p.createdAt,
    }));

    return {
      items,
      total: items.length,
    };
  }

  /**
   * Get permission matrix (grouped by module with role assignments)
   */
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    // Get all permissions
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    // Get all roles with their permissions
    const roles = await this.prisma.role.findMany({
      where: { deletedAt: null },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Group permissions by module
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

    // Build role permission matrix
    const roleMatrix: RolePermissionMatrixDto[] = roles.map(role => ({
      roleId: role.id,
      roleName: role.name,
      roleKey: role.key,
      permissionIds: role.rolePermissions.map(rp => rp.permissionId),
    }));

    return {
      modules: Array.from(moduleMap.values()),
      roles: roleMatrix,
    };
  }

  /**
   * Update role permissions (replaces existing)
   */
  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<UpdateRolePermissionsResponseDto> {
    // Verify role exists
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found', [
        { reason: ErrorCodes.ROLE_NOT_FOUND, message: 'Role does not exist or has been deleted' },
      ]);
    }

    // Verify all permission IDs exist
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    });

    if (permissions.length !== dto.permissionIds.length) {
      const foundIds = permissions.map(p => p.id);
      const missingIds = dto.permissionIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException('Some permissions not found', [
        {
          reason: ErrorCodes.NOT_FOUND,
          message: `Permission IDs not found: ${missingIds.join(', ')}`,
        },
      ]);
    }

    // Delete existing role permissions and create new ones
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({
        where: { roleId },
      }),
      this.prisma.rolePermission.createMany({
        data: dto.permissionIds.map(permissionId => ({
          roleId,
          permissionId,
        })),
      }),
    ]);

    this.logger.log(
      `Updated permissions for role ${roleId}: ${dto.permissionIds.length} permissions`,
    );

    return {
      roleId,
      permissionCount: permissions.length,
      permissionKeys: permissions.map(p => p.permissionKey),
    };
  }

  /**
   * Update user permission overrides
   */
  async updateUserPermissions(
    userId: string,
    dto: UpdateUserPermissionsDto,
  ): Promise<UpdateUserPermissionsResponseDto> {
    // Verify user exists
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found', [
        { reason: ErrorCodes.USER_NOT_FOUND, message: 'User does not exist or has been deleted' },
      ]);
    }

    const allPermissionIds = [...(dto.grants || []), ...(dto.denies || [])];

    // Verify all permission IDs exist
    if (allPermissionIds.length > 0) {
      const permissions = await this.prisma.permission.findMany({
        where: { id: { in: allPermissionIds } },
      });

      if (permissions.length !== allPermissionIds.length) {
        const foundIds = permissions.map(p => p.id);
        const missingIds = allPermissionIds.filter(id => !foundIds.includes(id));
        throw new NotFoundException('Some permissions not found', [
          {
            reason: ErrorCodes.NOT_FOUND,
            message: `Permission IDs not found: ${missingIds.join(', ')}`,
          },
        ]);
      }
    }

    // Delete existing user permissions and create new ones
    await this.prisma.$transaction(async tx => {
      await tx.userPermission.deleteMany({
        where: { userId },
      });

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

    // Fetch updated permissions
    const userPermissions = await this.prisma.userPermission.findMany({
      where: { userId },
      include: { permission: true },
    });

    this.logger.log(`Updated permission overrides for user ${userId}`);

    return {
      userId,
      overrides: userPermissions.map(up => ({
        permissionId: up.permissionId,
        permissionKey: up.permission.permissionKey,
        effect: up.effect,
      })),
    };
  }
}
