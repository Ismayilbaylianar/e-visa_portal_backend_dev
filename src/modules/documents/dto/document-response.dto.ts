import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  applicationApplicantId: string;

  @ApiProperty({
    description: 'Document type key',
    example: 'passportScan',
  })
  documentTypeKey: string;

  @ApiProperty({
    description: 'Original file name',
    example: 'passport.pdf',
  })
  originalFileName: string;

  @ApiProperty({
    description: 'MIME type of the file',
    example: 'application/pdf',
  })
  mimeType: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 102400,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Review status of the document',
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REUPLOAD'],
    example: 'PENDING',
  })
  reviewStatus: string;

  @ApiPropertyOptional({
    description: 'Review note from admin',
    example: 'Document is valid',
  })
  reviewNote?: string | null;

  @ApiProperty({
    description: 'Timestamp when the document was uploaded',
    example: '2026-04-01T10:00:00.000Z',
  })
  uploadedAt: Date;

  @ApiPropertyOptional({
    description: 'Timestamp when the document was reviewed',
  })
  reviewedAt?: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
