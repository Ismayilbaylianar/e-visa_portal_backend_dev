import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Specifies which roles can access a route
 * @param roles - Array of role keys
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
