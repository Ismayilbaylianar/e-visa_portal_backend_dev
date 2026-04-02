import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayUnique } from 'class-validator';

export class UpdateRolePermissionsDto {
  @ApiProperty({
    description: 'List of permission IDs to assign to the role (replaces existing)',
    type: [String],
    example: ['perm_1', 'perm_2', 'perm_3'],
  })
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each permission ID must be a valid UUID' })
  @ArrayUnique({ message: 'Permission IDs must be unique' })
  permissionIds: string[];
}

export class UpdateRolePermissionsResponseDto {
  @ApiProperty({ description: 'Role ID', example: 'role_1' })
  roleId: string;

  @ApiProperty({ description: 'Number of permissions assigned', example: 3 })
  permissionCount: number;

  @ApiProperty({
    description: 'List of assigned permission keys',
    type: [String],
    example: ['users.read', 'users.create', 'users.update'],
  })
  permissionKeys: string[];
}
