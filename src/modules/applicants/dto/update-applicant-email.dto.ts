import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Module 9 — admin-side per-applicant email correction.
 *
 * The portal flow validates email at submission time but admins
 * routinely fix typos discovered during review (`john@gmial.com` →
 * `john@gmail.com`). The optional `reason` is captured in the audit
 * trail so the customer or compliance team can later see who changed
 * what and why. We don't enforce reason on email-only changes
 * because typo fixes are common and don't carry the same SLA
 * implications as estimated-time changes.
 */
export class UpdateApplicantEmailDto {
  @ApiProperty({ description: 'New email for this applicant', example: 'corrected@example.com' })
  @IsEmail({}, { message: 'Must be a valid email address' })
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    description: 'Why the email is being changed (audit context)',
    example: 'Typo reported by customer support',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
