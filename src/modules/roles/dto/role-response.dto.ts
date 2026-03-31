import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({
    description: 'Role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Role name',
    example: 'Administrator',
  })
  name: string;

  @ApiProperty({
    description: 'Role key',
    example: 'admin',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Full system access with all permissions',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether this is a system role',
    example: false,
  })
  isSystem: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
