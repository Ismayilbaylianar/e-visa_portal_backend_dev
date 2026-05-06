import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckResetTokenResponseDto {
  @ApiProperty({ description: 'True when the token can be consumed by /reset-password.' })
  valid: boolean;

  @ApiPropertyOptional({
    description: 'Masked email when valid, so the form can show "Resetting password for a***@example.com".',
    example: 'a***@gmail.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Reason when invalid: "expired" | "used" | "unknown".',
  })
  reason?: 'expired' | 'used' | 'unknown';
}
