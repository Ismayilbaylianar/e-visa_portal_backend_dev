import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';

/**
 * PermissionsController - Skeleton for permission management endpoints
 * Will be implemented in future stages
 *
 * Planned endpoints:
 * - GET /permissions - List permissions
 * - GET /permissions/:id - Get permission by ID
 * - POST /permissions - Create permission
 * - PATCH /permissions/:id - Update permission
 * - DELETE /permissions/:id - Delete permission
 */
@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // TODO: Implement list permissions endpoint
  // TODO: Implement get permission by ID endpoint
  // TODO: Implement create permission endpoint
  // TODO: Implement update permission endpoint
  // TODO: Implement delete permission endpoint
}
