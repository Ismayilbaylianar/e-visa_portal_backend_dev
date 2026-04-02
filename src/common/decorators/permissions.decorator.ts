import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { PermissionsGuard } from '../guards/permissions.guard';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Specifies which permissions are required to access a route
 * @param permissions - Array of permission keys (e.g., 'users.read', 'users.create')
 */
export const RequirePermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    UseGuards(PermissionsGuard),
    ApiForbiddenResponse({ description: 'Permission denied' }),
  );
