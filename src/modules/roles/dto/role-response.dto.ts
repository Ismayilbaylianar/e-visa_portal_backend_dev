import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ description: 'Role ID', example: 'role_1' })
  id: string;

  @ApiProperty({ description: 'Role display name', example: 'Super Admin' })
  name: string;

  @ApiProperty({ description: 'Role unique key', example: 'superAdmin' })
  key: string;

  @ApiPropertyOptional({ description: 'Role description', example: 'Full system access' })
  description?: string;

  @ApiProperty({ description: 'Whether this is a system role', example: true })
  isSystem: boolean;

  @ApiProperty({ description: 'Number of users with this role', example: 1 })
  userCount: number;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-03-31T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-03-31T10:00:00Z' })
  updatedAt: Date;
}

export class RoleListResponseDto {
  @ApiProperty({ type: [RoleResponseDto], description: 'List of roles' })
  items: RoleResponseDto[];

  @ApiProperty({ description: 'Total count', example: 3 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}
