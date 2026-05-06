import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { UserInfoDto } from './login.dto';

export class RefreshTokenDto {
  /**
   * M11.4 — refresh token now arrives via the httpOnly cookie set
   * on login. The body field is kept optional for backwards
   * compatibility (older mobile clients, the existing demo curl
   * traces) but the controller prefers the cookie when both are
   * present, and the validator no longer rejects requests that send
   * neither (the controller does that with a friendlier message).
   */
  @ApiPropertyOptional({
    description:
      'Refresh token. Optional — preferred path is the httpOnly `evisa_admin_refresh` cookie set on login.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({ description: 'New JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'New JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration time in seconds', example: 3600 })
  expiresInSeconds: number;

  @ApiProperty({
    description:
      'Authenticated user info refreshed with current permissions. Frontend stores rely on this to keep permission-gated UI in sync after token refresh.',
    type: UserInfoDto,
  })
  user: UserInfoDto;
}
