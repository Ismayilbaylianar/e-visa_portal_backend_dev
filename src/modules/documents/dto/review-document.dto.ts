import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_REUPLOAD = 'NEEDS_REUPLOAD',
}

export class ReviewDocumentDto {
  @ApiProperty({
    description: 'Review status for the document',
    enum: ReviewStatus,
    example: 'APPROVED',
  })
  @IsNotEmpty()
  @IsEnum(ReviewStatus)
  reviewStatus: ReviewStatus;

  @ApiPropertyOptional({
    description: 'Optional note explaining the review decision',
    example: 'Document is valid',
  })
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
