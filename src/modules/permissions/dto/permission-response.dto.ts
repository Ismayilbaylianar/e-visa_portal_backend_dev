import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty({
    description: 'Permission ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Module key (e.g., users, applications, roles)',
    example: 'users',
  })
  moduleKey: string;

  @ApiProperty({
    description: 'Action key (e.g., read, create, update, delete)',
    example: 'read',
  })
  actionKey: string;

  @ApiProperty({
    description: 'Full permission key (module.action format)',
    example: 'users.read',
  })
  permissionKey: string;

  @ApiPropertyOptional({
    description: 'Permission description',
    example: 'Allows reading user data',
  })
  description?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

export class PermissionListResponseDto {
  @ApiProperty({ type: [PermissionResponseDto] })
  items: PermissionResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}
