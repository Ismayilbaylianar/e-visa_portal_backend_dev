import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty({ description: 'Permission ID', example: 'perm_1' })
  id: string;

  @ApiProperty({ description: 'Module key', example: 'users' })
  moduleKey: string;

  @ApiProperty({ description: 'Action key', example: 'read' })
  actionKey: string;

  @ApiProperty({ description: 'Full permission key', example: 'users.read' })
  permissionKey: string;

  @ApiPropertyOptional({ description: 'Permission description', example: 'View users' })
  description?: string;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-03-31T10:00:00Z' })
  createdAt: Date;
}

export class PermissionListResponseDto {
  @ApiProperty({ type: [PermissionResponseDto], description: 'List of permissions' })
  items: PermissionResponseDto[];

  @ApiProperty({ description: 'Total count', example: 12 })
  total: number;
}
