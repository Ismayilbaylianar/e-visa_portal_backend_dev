import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  IsEnum,
  ValidateNested,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PermissionEffect {
  ALLOW = 'ALLOW',
  DENY = 'DENY',
}

export class UserPermissionItemDto {
  @ApiProperty({
    description: 'Permission ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  permissionId: string;

  @ApiProperty({
    description: 'Permission effect (ALLOW or DENY)',
    enum: PermissionEffect,
    example: PermissionEffect.ALLOW,
  })
  @IsEnum(PermissionEffect)
  effect: PermissionEffect;
}

export class UpdateUserPermissionsDto {
  @ApiProperty({
    description: 'Array of user permission assignments',
    type: [UserPermissionItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionItemDto)
  permissions: UserPermissionItemDto[];
}
