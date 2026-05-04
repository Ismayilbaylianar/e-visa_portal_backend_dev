import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Module 9 — admin-facing metadata for a single applicant's issued
 * visa PDF. Mirrors the Document row (typeKey='issued_visa') plus
 * the issuance reference number captured at upload time.
 */
export class IssuedVisaResponseDto {
  @ApiProperty({ description: 'Document UUID (the issued-visa Document row)' })
  documentId!: string;

  @ApiProperty({ description: 'Original filename uploaded by admin' })
  originalFileName!: string;

  @ApiProperty({ description: 'Bytes' })
  fileSize!: number;

  @ApiPropertyOptional({ description: 'SHA-256 checksum (storage layer)' })
  checksum?: string;

  @ApiProperty({ description: 'When the visa was issued' })
  issuedAt!: Date;

  @ApiPropertyOptional({ description: 'Admin who issued the visa' })
  issuedByUserId?: string;

  @ApiPropertyOptional({
    description: 'Government / consular reference number recorded at issuance',
  })
  referenceNumber?: string;

  @ApiPropertyOptional({ description: 'Admin notes captured at issuance' })
  notes?: string;
}

/**
 * Result returned by the issue-visa endpoint. Includes the resulting
 * application + applicant status so the frontend can update its
 * cache atomically without a follow-up GET.
 */
export class IssueVisaResponseDto {
  @ApiProperty({ description: 'New issued-visa Document UUID' })
  documentId!: string;

  @ApiProperty({ description: 'Applicant whose visa was issued' })
  applicantId!: string;

  @ApiProperty({ description: 'Applicant status (READY_TO_DOWNLOAD on success)' })
  applicantStatus!: string;

  @ApiProperty({
    description:
      'Application status — flips to READY_TO_DOWNLOAD when ALL applicants on this app have an issued visa.',
  })
  applicationStatus!: string;

  @ApiProperty({
    description:
      'True when this issuance was the last one needed and the application transitioned to READY_TO_DOWNLOAD.',
  })
  allApplicantsIssued!: boolean;

  @ApiProperty({
    description: 'True when an existing issued visa was replaced (vs first-issue).',
  })
  replaced!: boolean;
}
