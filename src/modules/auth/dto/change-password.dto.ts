import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength, Matches } from 'class-validator';

/**
 * M11.4 — body for POST /admin/auth/change-password.
 *
 * `currentPassword` is optional at the wire level because the
 * first-login forced-change flow doesn't have one to verify (the
 * user just authenticated with the seeded password). The service
 * enforces it when `mustChangePassword=false`.
 *
 * Password complexity is the same as the reset flow: 8+ chars,
 * letter + number + symbol. Usable security — explicitly not
 * requiring uppercase to keep the rule readable.
 */
export class ChangePasswordDto {
  @ApiPropertyOptional({
    description: 'Current password — required when mustChangePassword is false on the user.',
    example: 'OldPassword!1',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiProperty({
    description: '8+ chars, must contain at least one letter, one number, and one symbol.',
    example: 'NewSecure!42',
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters' })
  @Matches(/[A-Za-z]/, { message: 'New password must contain at least one letter' })
  @Matches(/\d/, { message: 'New password must contain at least one number' })
  @Matches(/[^A-Za-z0-9]/, { message: 'New password must contain at least one symbol' })
  newPassword: string;
}
