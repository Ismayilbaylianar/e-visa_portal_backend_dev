import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: 'Role display name',
    example: 'Senior Reviewer',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Role unique key (lowercase, alphanumeric with underscores)',
    example: 'senior_reviewer',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Key must be at least 2 characters' })
  @MaxLength(50, { message: 'Key must not exceed 50 characters' })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message:
      'Key must start with lowercase letter and contain only lowercase letters, numbers, and underscores',
  })
  key?: string;

  @ApiPropertyOptional({
    description: 'Role description',
    example: 'Updated role description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;
}
