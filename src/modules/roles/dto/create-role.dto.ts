import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsBoolean,
  Matches,
  IsArray,
  IsUUID,
  ArrayUnique,
  ArrayMaxSize,
} from 'class-validator';

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

  /**
   * Module 6b — assign permissions inline at create time so the admin
   * doesn't have to POST role then PATCH permissions in two trips. The
   * service runs both writes in one transaction so a partial failure
   * never leaves an empty orphan role behind. Empty array = role with
   * zero permissions (still valid, admin can assign later via the
   * matrix page).
   */
  @ApiPropertyOptional({
    description:
      'Permission UUIDs to assign at creation time. Optional — if omitted, the role is created with zero permissions and admin can assign them via the matrix page.',
    type: [String],
    example: ['<uuid-1>', '<uuid-2>'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200, { message: 'Cannot assign more than 200 permissions at once' })
  @ArrayUnique({ message: 'Permission IDs must be unique' })
  @IsUUID('4', { each: true, message: 'Each permission ID must be a valid UUID' })
  permissionIds?: string[];

  @ApiPropertyOptional({
    description: 'Whether this is a system role (protected from deletion)',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}
