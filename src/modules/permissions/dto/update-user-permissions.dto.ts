import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsUUID, ArrayUnique, IsOptional } from 'class-validator';

export class UpdateUserPermissionsDto {
  @ApiPropertyOptional({
    description: 'Permission IDs to grant (ALLOW effect)',
    type: [String],
    example: ['perm_5', 'perm_6'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each permission ID must be a valid UUID' })
  @ArrayUnique({ message: 'Permission IDs must be unique' })
  grants?: string[];

  @ApiPropertyOptional({
    description: 'Permission IDs to deny (DENY effect)',
    type: [String],
    example: ['perm_7'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each permission ID must be a valid UUID' })
  @ArrayUnique({ message: 'Permission IDs must be unique' })
  denies?: string[];
}

export class UserPermissionOverrideDto {
  @ApiProperty({ description: 'Permission ID', example: 'perm_5' })
  permissionId: string;

  @ApiProperty({ description: 'Permission key', example: 'users.delete' })
  permissionKey: string;

  @ApiProperty({ description: 'Effect', enum: ['ALLOW', 'DENY'], example: 'ALLOW' })
  effect: 'ALLOW' | 'DENY';
}

export class UpdateUserPermissionsResponseDto {
  @ApiProperty({ description: 'User ID', example: 'usr_1' })
  userId: string;

  @ApiProperty({
    description: 'User permission overrides',
    type: [UserPermissionOverrideDto],
  })
  overrides: UserPermissionOverrideDto[];
}
