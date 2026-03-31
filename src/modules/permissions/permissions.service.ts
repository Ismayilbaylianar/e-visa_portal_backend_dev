import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PermissionResponseDto,
  PermissionMatrixResponseDto,
  PermissionModuleDto,
  RolePermissionMatrixDto,
  UpdateRolePermissionsDto,
  UpdateUserPermissionsDto,
} from './dto';
import { NotFoundException } from '@/common/exceptions';
import { PaginationMeta } from '@/common/types';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions
   */
  async findAll(): Promise<{ items: PermissionResponseDto[]; pagination: PaginationMeta }> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
    });

    const items = permissions.map(permission => this.mapToResponse(permission));

    return {
      items,
      pagination: {
        page: 1,
        limit: items.length,
        total: items.length,
        totalPages: 1,
      },
    };
  }

  /**
   * Get permission matrix view (permissions grouped by module with role assignments)
   */
  async getMatrix(): Promise<PermissionMatrixResponseDto> {
    const [permissions, roles] = await Promise.all([
      this.prisma.permission.findMany({
        orderBy: [{ moduleKey: 'asc' }, { actionKey: 'asc' }],
      }),
      this.prisma.role.findMany({
        where: { deletedAt: null },
        include: {
          rolePermissions: {
            select: { permissionId: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const moduleMap = new Map<string, PermissionModuleDto>();

    for (const permission of permissions) {
      if (!moduleMap.has(permission.moduleKey)) {
        moduleMap.set(permission.moduleKey, {
          moduleKey: permission.moduleKey,
          permissions: [],
        });
      }

      moduleMap.get(permission.moduleKey)!.permissions.push({
        id: permission.id,
        actionKey: permission.actionKey,
        permissionKey: permission.permissionKey,
        description: permission.description || undefined,
      });
    }

    const modules = Array.from(moduleMap.values());

    const rolesMatrix: RolePermissionMatrixDto[] = roles.map(role => ({
      id: role.id,
      name: role.name,
      key: role.key,
      permissionIds: role.rolePermissions.map(rp => rp.permissionId),
    }));

    return {
      modules,
      roles: rolesMatrix,
    };
  }

  /**
   * Update role permissions (replace all permissions for a role)
   */
  async updateRolePermissions(
    roleId: string,
    dto: UpdateRolePermissionsDto,
  ): Promise<RolePermissionMatrixDto> {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, deletedAt: null },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const validPermissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
      select: { id: true },
    });

    const validPermissionIds = validPermissions.map(p => p.id);
    const invalidIds = dto.permissionIds.filter(id => !validPermissionIds.includes(id));

    if (invalidIds.length > 0) {
      throw new NotFoundException(`Permissions not found: ${invalidIds.join(', ')}`);
    }

    await this.prisma.$transaction(async tx => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (dto.permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map(permissionId => ({
            roleId,
            permissionId,
          })),
        });
      }
    });

    this.logger.log(
      `Role permissions updated: ${roleId} -> ${dto.permissionIds.length} permissions`,
    );

    return {
      id: role.id,
      name: role.name,
      key: role.key,
      permissionIds: dto.permissionIds,
    };
  }

  /**
   * Update user-specific permissions (override role permissions)
   */
  async updateUserPermissions(
    userId: string,
    dto: UpdateUserPermissionsDto,
  ): Promise<{ userId: string; permissions: { permissionId: string; effect: string }[] }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissionIds = dto.permissions.map(p => p.permissionId);
    const validPermissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { id: true },
    });

    const validPermissionIds = validPermissions.map(p => p.id);
    const invalidIds = permissionIds.filter(id => !validPermissionIds.includes(id));

    if (invalidIds.length > 0) {
      throw new NotFoundException(`Permissions not found: ${invalidIds.join(', ')}`);
    }

    await this.prisma.$transaction(async tx => {
      await tx.userPermission.deleteMany({
        where: { userId },
      });

      if (dto.permissions.length > 0) {
        await tx.userPermission.createMany({
          data: dto.permissions.map(p => ({
            userId,
            permissionId: p.permissionId,
            effect: p.effect,
          })),
        });
      }
    });

    this.logger.log(
      `User permissions updated: ${userId} -> ${dto.permissions.length} permissions`,
    );

    return {
      userId,
      permissions: dto.permissions.map(p => ({
        permissionId: p.permissionId,
        effect: p.effect,
      })),
    };
  }

  private mapToResponse(permission: any): PermissionResponseDto {
    return {
      id: permission.id,
      moduleKey: permission.moduleKey,
      actionKey: permission.actionKey,
      permissionKey: permission.permissionKey,
      description: permission.description || undefined,
      createdAt: permission.createdAt,
    };
  }
}
