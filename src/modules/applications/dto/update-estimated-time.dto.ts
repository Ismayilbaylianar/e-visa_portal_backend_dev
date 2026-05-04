import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, MaxLength, Max, Min, MinLength } from 'class-validator';

/**
 * Module 9 — admin updates the SLA estimate. `reason` is REQUIRED on
 * every change (1-500 chars) so the estimate-change history table is
 * meaningful for the customer ("why did 5 days become 10 days?").
 */
export class UpdateEstimatedTimeDto {
  @ApiProperty({ description: 'New estimated processing days (1-365)', example: 7 })
  @IsInt()
  @Min(1, { message: 'estimatedDays must be at least 1' })
  @Max(365, { message: 'estimatedDays must not exceed 365' })
  estimatedDays!: number;

  @ApiProperty({
    description:
      'Why the estimate is changing — required so customer-facing history pages have context. Min 3 chars to block low-effort placeholders like "x".',
    example: 'Standard processing window for tourism visas',
  })
  @IsString()
  @MinLength(3, { message: 'reason must be at least 3 characters' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason!: string;
}

/**
 * One row in the estimated-time-change log. Returned by GET
 * /admin/applications/:id/estimated-time-changes.
 */
export class EstimatedTimeChangeEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true, description: 'null on the first time the estimate was set' })
  oldDays!: number | null;

  @ApiProperty()
  newDays!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty({ nullable: true })
  changedByUserId!: string | null;

  @ApiProperty({ nullable: true })
  changedByUser!: { id: string; fullName: string; email: string } | null;

  @ApiProperty()
  createdAt!: Date;
}
