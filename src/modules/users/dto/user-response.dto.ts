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

  @ApiPropertyOptional({ description: 'Role key (machine identifier)', example: 'operator' })
  roleKey?: string;

  @ApiPropertyOptional({ description: 'Role display name', example: 'Operator' })
  roleName?: string;

  @ApiProperty({
    description:
      'True when the user role is the super-admin role. Frontend uses this to disable Delete and Status toggle controls in the admin UI without re-deriving the rule.',
    example: false,
  })
  isSuperAdmin: boolean;

  @ApiProperty({ description: 'Whether user is active', example: true })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto], description: 'List of users' })
  items: UserResponseDto[];

  @ApiProperty({ description: 'Total count', example: 10 })
  total: number;

  @ApiProperty({ description: 'Current page', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Total pages', example: 1 })
  totalPages: number;
}
