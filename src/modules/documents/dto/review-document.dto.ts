import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DocumentReviewStatus } from '@/common/enums';

export class ReviewDocumentDto {
  @ApiProperty({
    description: 'Review status for the document',
    enum: DocumentReviewStatus,
    example: DocumentReviewStatus.APPROVED,
  })
  @IsNotEmpty()
  @IsEnum(DocumentReviewStatus)
  reviewStatus: DocumentReviewStatus;

  @ApiPropertyOptional({
    description: 'Optional note explaining the review decision',
    example: 'Document is clear and valid',
  })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
