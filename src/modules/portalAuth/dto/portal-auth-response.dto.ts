import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalIdentityResponseDto {
  @ApiProperty({ description: 'Portal identity ID' })
  id: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Whether the identity is active' })
  isActive: boolean;
}

export class PortalAuthResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds', example: 3600 })
  expiresInSeconds: number;

  @ApiProperty({ description: 'Portal identity details', type: PortalIdentityResponseDto })
  portalIdentity: PortalIdentityResponseDto;
}

export class SendOtpResponseDto {
  @ApiProperty({ description: 'Success message', example: 'OTP sent successfully' })
  message: string;

  @ApiPropertyOptional({
    description: 'OTP code (only in development mode)',
    example: '123456',
  })
  devOtpCode?: string;

  @ApiProperty({ description: 'OTP expiration time' })
  expiresAt: Date;
}
