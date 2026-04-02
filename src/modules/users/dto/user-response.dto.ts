import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID', example: 'usr_2' })
  id: string;

  @ApiProperty({ description: 'User full name', example: 'Operator User' })
  fullName: string;

  @ApiProperty({ description: 'User email', example: 'operator@visa.com' })
  email: string;

  @ApiPropertyOptional({ description: 'Role ID', example: 'role_3' })
  roleId?: string;

  @ApiPropertyOptional({ description: 'Role key', example: 'operator' })
  roleKey?: string;

  @ApiProperty({ description: 'Whether user is active', example: true })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Last login timestamp', example: '2026-03-31T10:00:00Z' })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-03-31T10:00:00Z' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-03-31T10:00:00Z' })
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto], description: 'List of users' })
  items: UserResponseDto[];

  @ApiProperty({ description: 'Total count', example: 10 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 10 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}
