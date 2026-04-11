import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role display name',
    example: 'Reviewer',
  })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  @ApiProperty({
    description: 'Role unique key (lowercase, alphanumeric with underscores)',
    example: 'reviewer',
  })
  @IsString()
  @MinLength(2, { message: 'Key must be at least 2 characters' })
  @MaxLength(50, { message: 'Key must not exceed 50 characters' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Reviews applications',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a system role (protected from deletion)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
