import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserRoleDto {
  @ApiProperty({ description: 'Role ID' })
  id: string;

  @ApiProperty({ description: 'Role name' })
  name: string;

  @ApiProperty({ description: 'Role key' })
  key: string;
}

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User full name' })
  fullName: string;

  @ApiProperty({ description: 'User email' })
  email: string;

  @ApiProperty({ description: 'Whether user is active' })
  isActive: boolean;

  @ApiPropertyOptional({ description: 'Role ID' })
  roleId?: string;

  @ApiPropertyOptional({ type: UserRoleDto, description: 'User role' })
  role?: UserRoleDto;

  @ApiPropertyOptional({ description: 'Last login timestamp' })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  items: UserResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}
