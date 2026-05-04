import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '@prisma/client';

/**
 * M9b — request body for the customer document resubmission endpoint.
 *
 * Multipart shape:
 *   files[]  — the actual file uploads (Multer mounts these)
 *   types[]  — parallel array of documentTypeKeys, one per file in
 *              the same order as `files[]`
 *
 * The DTO documents the shape for Swagger; runtime validation lives
 * in the service (we can't use class-validator on the file array
 * since Multer hands us `Express.Multer.File[]` objects, not
 * arbitrary JSON we control).
 */
export class ResubmitDocumentsBodyDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Files to upload (PDF/JPG/PNG, max 10MB each, max 10 files per call)',
  })
  files!: unknown[];

  @ApiProperty({
    type: 'array',
    items: { type: 'string' },
    description:
      'Parallel array of documentTypeKey strings, one per file in the same order. Each must appear in the application\'s requestedDocumentTypes.',
    example: ['bank_statement', 'hotel_booking'],
  })
  types!: string[];
}

export class ResubmitDocumentsResponseDto {
  @ApiProperty({ description: 'Number of files successfully uploaded' })
  uploaded!: number;

  @ApiProperty({
    enum: ApplicationStatus,
    description:
      'Application status after the resubmission. Flips to SUBMITTED if every requested document is now satisfied; stays NEED_DOCS otherwise.',
  })
  applicationStatus!: ApplicationStatus;

  @ApiProperty({
    type: [String],
    description:
      'Document type keys still missing. Empty when the application has flipped back to SUBMITTED.',
  })
  requestedTypesRemaining!: string[];
}
