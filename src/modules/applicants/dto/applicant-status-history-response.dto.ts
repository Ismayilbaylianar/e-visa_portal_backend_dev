import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Module 9 — single row in the applicant status timeline. Used by
 * GET /admin/applicants/:id/status-history. Actor name is resolved
 * server-side so the frontend doesn't need a second user-detail
 * fetch per row.
 */
export class ApplicantStatusHistoryEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  oldStatus!: string;

  @ApiProperty()
  newStatus!: string;

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty({ description: 'True when the system flipped status (no human actor)' })
  changedBySystem!: boolean;

  @ApiPropertyOptional({ description: 'Admin who made the change (null for system actions)' })
  changedByUserId?: string;

  @ApiPropertyOptional()
  changedByUser?: { id: string; fullName: string; email: string };

  @ApiProperty()
  createdAt!: Date;
}
