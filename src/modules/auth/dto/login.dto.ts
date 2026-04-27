import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'super@visa.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'super123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

export class UserInfoDto {
  @ApiProperty({ description: 'User ID', example: 'usr_1' })
  id: string;

  @ApiProperty({ description: 'User full name', example: 'Super Admin' })
  fullName: string;

  @ApiProperty({ description: 'User email', example: 'super@visa.com' })
  email: string;

  @ApiProperty({ description: 'Role ID', example: 'role_1', required: false })
  roleId?: string;

  @ApiProperty({ description: 'Role key', example: 'superAdmin', required: false })
  roleKey?: string;

  @ApiProperty({ description: 'Whether user is active', example: true })
  isActive: boolean;

  @ApiProperty({
    description:
      'Effective permission keys for this user (role permissions + user grants - user denies)',
    type: [String],
    example: ['countries.read', 'countries.create', 'countries.update'],
  })
  permissions: string[];
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds', example: 3600 })
  expiresInSeconds: number;

  @ApiProperty({ description: 'Authenticated user information', type: UserInfoDto })
  user: UserInfoDto;
}
