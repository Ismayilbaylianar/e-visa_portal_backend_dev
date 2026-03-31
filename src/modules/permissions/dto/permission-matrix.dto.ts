import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ModulePermissionDto {
  @ApiProperty({
    description: 'Permission ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Action key',
    example: 'read',
  })
  actionKey: string;

  @ApiProperty({
    description: 'Full permission key',
    example: 'users.read',
  })
  permissionKey: string;

  @ApiPropertyOptional({
    description: 'Permission description',
    example: 'Allows reading user data',
  })
  description?: string;
}

export class PermissionModuleDto {
  @ApiProperty({
    description: 'Module key',
    example: 'users',
  })
  moduleKey: string;

  @ApiProperty({
    description: 'List of permissions in this module',
    type: [ModulePermissionDto],
  })
  permissions: ModulePermissionDto[];
}

export class RolePermissionMatrixDto {
  @ApiProperty({
    description: 'Role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Role name',
    example: 'Admin',
  })
  name: string;

  @ApiProperty({
    description: 'Role key',
    example: 'admin',
  })
  key: string;

  @ApiProperty({
    description: 'List of permission IDs assigned to this role',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  permissionIds: string[];
}

export class PermissionMatrixResponseDto {
  @ApiProperty({
    description: 'Permissions grouped by module',
    type: [PermissionModuleDto],
  })
  modules: PermissionModuleDto[];

  @ApiProperty({
    description: 'Roles with their assigned permissions',
    type: [RolePermissionMatrixDto],
  })
  roles: RolePermissionMatrixDto[];
}
