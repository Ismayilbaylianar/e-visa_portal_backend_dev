import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * Stage 3 — FIRST DECISION, accept branch.
 *
 * The operator accepts a SUBMITTED application: the held funds are
 * captured, an operator is assigned (chosen right here, at accept time —
 * there is no auto-assign), and the application moves to PROCESSING.
 */
export class AcceptApplicationDto {
  @ApiProperty({
    description:
      'Operator to assign the application to. Chosen at accept time. Assigning to anyone other than yourself requires the applications.assign permission.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  assigneeId: string;

  @ApiPropertyOptional({
    description:
      'Optional internal/customer-facing note. Stored on the application and appended to the "processing started" email.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

/**
 * Stage 3 — FIRST DECISION, cancel branch.
 *
 * The operator found a disqualifying issue: the authorization is released
 * in full (nothing is charged) and the application becomes CANCELLED,
 * which is terminal — the customer fixes the issue and submits a NEW
 * application. The reason is mandatory because it is what the customer
 * receives in the explanatory email.
 */
export class CancelApplicationDto {
  @ApiProperty({
    description:
      'Why the application is being cancelled. Sent to the customer verbatim, so write it for them.',
    minLength: 10,
    maxLength: 2000,
    example:
      'The passport scan is not machine-readable, so the application cannot be processed.',
  })
  @IsString()
  @MinLength(10, { message: 'A cancellation reason of at least 10 characters is required' })
  @MaxLength(2000)
  reason: string;
}
