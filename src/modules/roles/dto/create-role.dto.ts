import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, IsBoolean, Matches } from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    description: 'Role name',
    example: 'Administrator',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Role key (unique identifier, lowercase with underscores)',
    example: 'admin',
    minLength: 2,
    maxLength: 50,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Key must start with a letter and contain only lowercase letters, numbers, and underscores',
  })
  key: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Full system access with all permissions',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a system role (cannot be deleted)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
