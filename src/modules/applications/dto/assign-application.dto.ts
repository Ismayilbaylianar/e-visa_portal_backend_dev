import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

/**
 * M-Assign — assign or unassign an operator to an application.
 *
 * Pass `assigneeId: null` (or omit it) to UNASSIGN. Pass a real
 * user id to assign / reassign. Optional `reason` is captured in
 * the assignment history so the audit trail tells a story.
 */
export class AssignApplicationDto {
  @ApiPropertyOptional({
    description:
      'User id of the operator to assign. Omit or send null to unassign.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    description: 'Short note explaining the change (≤500 chars).',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * M-Assign — create or edit an internal note on an application.
 * Visibility stays 'internal' for the launch; reserved for future
 * 'operator' / 'super_admin' subroles.
 */
export class CreateInternalNoteDto {
  @ApiProperty({
    description: 'Note body (1–5000 chars).',
    minLength: 1,
    maxLength: 5000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note: string;
}

export class UpdateInternalNoteDto {
  @ApiProperty({ minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  note: string;
}
