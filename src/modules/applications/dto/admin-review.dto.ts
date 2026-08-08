import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * DTO for approving an application
 */
export class ApproveApplicationDto {
  @ApiPropertyOptional({
    description: 'Optional note about the approval decision',
    example: 'All documents verified. Application meets all requirements.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/**
 * DTO for rejecting an application
 */
export class RejectApplicationDto {
  @ApiProperty({
    description: 'Reason for rejection (required)',
    example: 'Documents provided are expired or illegible.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;

  /**
   * Stage 3 Step 4 — selective refund. The payment is already CAPTURED
   * by the time an application can be rejected, so the operator decides
   * explicitly which portions go back. Each selected portion is refunded
   * IN FULL; omitting both is a valid choice (reject, refund nothing).
   */
  @ApiPropertyOptional({
    description:
      'Refund the government fee portion in full. Omit or false to keep it.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  refundGovernmentFee?: boolean;

  @ApiPropertyOptional({
    description: 'Refund the service fee portion in full. Omit or false to keep it.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  refundServiceFee?: boolean;
}

/**
 * DTO for generic admin status update (for extensibility)
 */
export class AdminStatusUpdateDto {
  @ApiProperty({
    description: 'New status for the application',
    example: 'PROCESSING',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Note explaining the status change',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
