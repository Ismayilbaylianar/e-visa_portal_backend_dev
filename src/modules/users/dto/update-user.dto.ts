import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'User full name',
    example: 'Updated Operator Name',
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Full name must be at least 2 characters' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'User email address',
    example: 'updated.operator@visa.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @ApiPropertyOptional({
    description: 'Role ID to assign to user',
    example: 'role_2',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  roleId?: string;
}

export class UpdateUserStatusDto {
  @ApiPropertyOptional({
    description: 'Whether the user is active',
    example: false,
  })
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive: boolean;
}

export class UpdateUserPasswordDto {
  @ApiPropertyOptional({
    description: 'New password',
    example: 'newPassword123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}
