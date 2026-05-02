import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Per-permission row showing the user's effective state. Powers the
 * granular override matrix UI (Modul 6b — 3-state radio: inherit /
 * allow / deny). The frontend reconstructs the matrix from this list
 * without making N round-trips.
 */
export class UserEffectivePermissionDto {
  @ApiProperty({ description: 'Permission ID', example: 'perm_1' })
  permissionId: string;

  @ApiProperty({ description: 'Module key', example: 'users' })
  moduleKey: string;

  @ApiProperty({ description: 'Action key', example: 'read' })
  actionKey: string;

  @ApiProperty({ description: 'Full permission key', example: 'users.read' })
  permissionKey: string;

  @ApiPropertyOptional({ description: 'Permission description' })
  description?: string;

  @ApiProperty({
    description: 'Whether the role grants this permission',
    example: true,
  })
  fromRole: boolean;

  @ApiProperty({
    description:
      'User-level override (null when inherited from role). ALLOW grants beyond role; DENY revokes a role grant.',
    enum: ['ALLOW', 'DENY'],
    nullable: true,
    example: null,
  })
  override: 'ALLOW' | 'DENY' | null;

  @ApiProperty({
    description:
      'Final effective state (role + overrides applied). True = user can perform this action.',
    example: true,
  })
  effective: boolean;
}

export class UserEffectivePermissionsResponseDto {
  @ApiProperty({ description: 'User ID', example: 'usr_1' })
  userId: string;

  @ApiPropertyOptional({ description: 'Role ID', example: 'role_3' })
  roleId?: string;

  @ApiPropertyOptional({ description: 'Role key', example: 'operator' })
  roleKey?: string;

  @ApiProperty({
    description:
      'Per-permission rows showing role contribution + user override + effective state.',
    type: [UserEffectivePermissionDto],
  })
  permissions: UserEffectivePermissionDto[];
}
