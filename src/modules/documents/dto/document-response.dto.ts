import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentReviewStatus } from '@/common/enums';

export class DocumentResponseDto {
  @ApiProperty({
    description: 'Document ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Applicant ID the document belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  applicantId: string;

  @ApiProperty({
    description: 'Document type key',
    example: 'passport',
  })
  documentTypeKey: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'passport_scan.pdf',
  })
  originalFileName: string;

  @ApiProperty({
    description: 'Storage key for the file',
    example: 'documents/550e8400/passport_scan.pdf',
  })
  storageKey: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Review status of the document',
    enum: DocumentReviewStatus,
    example: DocumentReviewStatus.PENDING,
  })
  reviewStatus: DocumentReviewStatus;

  @ApiPropertyOptional({
    description: 'Review note from admin',
    example: 'Document is clear and valid',
  })
  reviewNote?: string;

  @ApiProperty({
    description: 'Timestamp when the document was uploaded',
    example: '2024-01-15T10:30:00.000Z',
  })
  uploadedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the document was reviewed',
    example: '2024-01-16T14:00:00.000Z',
  })
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: 'ID of the user who reviewed the document',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  reviewedByUserId?: string;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-01-16T14:00:00.000Z',
  })
  updatedAt: Date;
}
