import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payment Stage 2 — release an authorization (void). Optional reason
 * recorded in the status history + transaction payload.
 */
export class ReleasePaymentDto {
  @ApiPropertyOptional({ description: 'Reason for releasing the authorization' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

/**
 * Payment Stage 2 — selective refund. Choose the government and/or
 * service fee portion; each selected portion is refunded in FULL (no
 * arbitrary partial amounts).
 */
export class RefundPaymentDto {
  @ApiPropertyOptional({ description: 'Refund the government fee portion in full' })
  @IsOptional()
  @IsBoolean()
  government?: boolean;

  @ApiPropertyOptional({ description: 'Refund the service fee portion in full' })
  @IsOptional()
  @IsBoolean()
  service?: boolean;

  @ApiPropertyOptional({ description: 'Reason for the refund' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
