import { ApiProperty } from '@nestjs/swagger';

export class ModulePermissionDto {
  @ApiProperty({ description: 'Permission ID', example: 'perm_1' })
  id: string;

  @ApiProperty({ description: 'Action key', example: 'read' })
  actionKey: string;

  @ApiProperty({ description: 'Full permission key', example: 'users.read' })
  permissionKey: string;

  @ApiProperty({ description: 'Permission description', example: 'View users' })
  description: string;
}

export class PermissionModuleDto {
  @ApiProperty({ description: 'Module key', example: 'users' })
  moduleKey: string;

  @ApiProperty({ description: 'Module display name', example: 'Users' })
  moduleName: string;

  @ApiProperty({ type: [ModulePermissionDto], description: 'Permissions in this module' })
  permissions: ModulePermissionDto[];
}

export class RolePermissionMatrixDto {
  @ApiProperty({ description: 'Role ID', example: 'role_1' })
  roleId: string;

  @ApiProperty({ description: 'Role name', example: 'Super Admin' })
  roleName: string;

  @ApiProperty({ description: 'Role key', example: 'superAdmin' })
  roleKey: string;

  @ApiProperty({
    description: 'List of assigned permission IDs',
    type: [String],
    example: ['perm_1', 'perm_2', 'perm_3'],
  })
  permissionIds: string[];
}

export class PermissionMatrixResponseDto {
  @ApiProperty({ type: [PermissionModuleDto], description: 'Permissions grouped by module' })
  modules: PermissionModuleDto[];

  @ApiProperty({ type: [RolePermissionMatrixDto], description: 'Role permission assignments' })
  roles: RolePermissionMatrixDto[];
}
