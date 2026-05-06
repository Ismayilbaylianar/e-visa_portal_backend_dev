import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  /**
   * M11.4 — same logic as RefreshTokenDto: prefer the httpOnly
   * cookie, accept body for backwards compat. Controller resolves
   * which one to use and fails with a friendly 400 if neither is
   * present.
   */
  @ApiPropertyOptional({
    description:
      'Refresh token to revoke. Optional — preferred path is the httpOnly `evisa_admin_refresh` cookie.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
