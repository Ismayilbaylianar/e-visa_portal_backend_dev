import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ForbiddenException } from '../exceptions';
import { ErrorCodes } from '../constants';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated', [
        { reason: ErrorCodes.UNAUTHORIZED, message: 'Authentication required' },
      ]);
    }

    if (!user.permissions || user.permissions.length === 0) {
      throw new ForbiddenException('Permission denied', [
        { reason: ErrorCodes.PERMISSION_DENIED, message: 'You do not have the required permissions' },
      ]);
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      user.permissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        p => !user.permissions.includes(p),
      );
      throw new ForbiddenException('Permission denied', [
        {
          reason: ErrorCodes.PERMISSION_DENIED,
          message: `Missing permissions: ${missingPermissions.join(', ')}`,
        },
      ]);
    }

    return true;
  }
}
