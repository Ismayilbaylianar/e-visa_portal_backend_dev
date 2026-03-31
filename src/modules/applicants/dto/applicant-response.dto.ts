import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicantStatus, DocumentReviewStatus } from '@/common/enums';

export class DocumentResponseDto {
  @ApiProperty({ description: 'Document ID' })
  id: string;

  @ApiProperty({ description: 'Document type key' })
  documentTypeKey: string;

  @ApiProperty({ description: 'Original file name' })
  originalFileName: string;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({
    description: 'Review status',
    enum: DocumentReviewStatus,
  })
  reviewStatus: DocumentReviewStatus;

  @ApiPropertyOptional({ description: 'Review note' })
  reviewNote?: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;

  @ApiPropertyOptional({ description: 'Review timestamp' })
  reviewedAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}

export class ApplicantResponseDto {
  @ApiProperty({ description: 'Applicant ID' })
  id: string;

  @ApiProperty({ description: 'Application ID' })
  applicationId: string;

  @ApiProperty({ description: 'Whether this is the main applicant' })
  isMainApplicant: boolean;

  @ApiProperty({ description: 'Applicant email' })
  email: string;

  @ApiPropertyOptional({ description: 'Applicant phone number' })
  phone?: string;

  @ApiProperty({
    description: 'Form data as JSON object',
    type: 'object',
  })
  formDataJson: Record<string, any>;

  @ApiProperty({
    description: 'Applicant status',
    enum: ApplicantStatus,
  })
  status: ApplicantStatus;

  @ApiPropertyOptional({ description: 'Unique application code' })
  applicationCode?: string;

  @ApiPropertyOptional({ description: 'Result file name' })
  resultFileName?: string;

  @ApiPropertyOptional({ description: 'Result storage key' })
  resultStorageKey?: string;

  @ApiPropertyOptional({
    description: 'Required documents configuration',
    type: 'object',
  })
  requiredDocumentsJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Additional documents requested',
    type: 'object',
  })
  additionalDocsRequestedJson?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Applicant documents',
    type: [DocumentResponseDto],
  })
  documents?: DocumentResponseDto[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt: Date;
}
