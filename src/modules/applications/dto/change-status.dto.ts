import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * M11.12 (BUG P) — Unified application status change.
 *
 * Subsumes the existing approve / reject endpoints (which stay
 * for back-compat). The new admin dialog
 * fires this single endpoint for every transition; the service
 * branches on `status` and applies the right side-effects:
 *   - APPROVED   → flip to APPROVED + send `application.approved`
 *   - REJECTED   → flip to REJECTED + send `application.rejected`,
 *                  `reason` required + persisted
 * *   - CANCELLED  → flip to CANCELLED, only allowed by super admin
 *
 * Email is OPTIONAL (operator can untoggle for silent admin-only
 * status moves). When sending, the operator can append a custom
 * "Message from our team" block to the standard template (template
 * mode) OR override entirely with a custom subject + body
 * (custom mode). Custom mode skips the template AND the standard
 * variables — the operator has full control.
 */
export class ChangeApplicationStatusDto {
  @ApiProperty({
    description: 'Target status for the application',
    enum: ['APPROVED', 'REJECTED', 'READY_TO_DOWNLOAD', 'CANCELLED'],
    example: 'APPROVED',
  })
  @IsString()
  @IsIn(['APPROVED', 'REJECTED', 'READY_TO_DOWNLOAD', 'CANCELLED'])
  status: 'APPROVED' | 'REJECTED' | 'READY_TO_DOWNLOAD' | 'CANCELLED';

  @ApiPropertyOptional({
    description: 'Whether to send a customer notification email. Defaults to true.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @ApiPropertyOptional({
    description:
      "Email mode. 'template' uses the system template + optional custom message; 'custom' uses the operator-supplied subject/body verbatim. Defaults to 'template'.",
    enum: ['template', 'custom'],
    example: 'template',
  })
  @IsOptional()
  @IsString()
  @IsIn(['template', 'custom'])
  emailMode?: 'template' | 'custom';

  @ApiPropertyOptional({
    description:
      'Optional message appended to the standard template as a "Message from our team" block. Ignored when emailMode=custom.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customMessage?: string;

  @ApiPropertyOptional({
    description: 'Custom email subject. Required when emailMode=custom.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customSubject?: string;

  @ApiPropertyOptional({
    description: 'Custom email body (plain text or basic HTML). Required when emailMode=custom.',
    maxLength: 10000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  customBody?: string;

  @ApiPropertyOptional({
    description:
      'Rejection reason. REQUIRED when status=REJECTED. Persisted on application.rejection_reason and surfaced in the rejection email + customer /me detail.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason?: string;
}
