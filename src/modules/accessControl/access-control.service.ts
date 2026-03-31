import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionEffect } from '@prisma/client';

export interface UserPermission {
  permissionKey: string;
  effect: PermissionEffect;
}

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if a user has a specific permission
   */
  async checkPermission(userId: string, permissionKey: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return false;
    }

    const userOverride = user.userPermissions.find(
      up => up.permission.permissionKey === permissionKey,
    );

    if (userOverride) {
      return userOverride.effect === PermissionEffect.ALLOW;
    }

    if (user.role) {
      const rolePermission = user.role.rolePermissions.find(
        rp => rp.permission.permissionKey === permissionKey,
      );
      return !!rolePermission;
    }

    return false;
  }

  /**
   * Get all effective permissions for a user (role + user-specific overrides)
   */
  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        userPermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    const permissionMap = new Map<string, UserPermission>();

    if (user.role) {
      for (const rp of user.role.rolePermissions) {
        permissionMap.set(rp.permission.permissionKey, {
          permissionKey: rp.permission.permissionKey,
          effect: PermissionEffect.ALLOW,
        });
      }
    }

    for (const up of user.userPermissions) {
      permissionMap.set(up.permission.permissionKey, {
        permissionKey: up.permission.permissionKey,
        effect: up.effect,
      });
    }

    return Array.from(permissionMap.values()).filter(
      p => p.effect === PermissionEffect.ALLOW,
    );
  }

  /**
   * Check if a user has a specific role
   */
  async hasRole(userId: string, roleKey: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, isActive: true },
      include: {
        role: true,
      },
    });

    if (!user || !user.role) {
      return false;
    }

    return user.role.key === roleKey;
  }
}
