import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for approving an application
 */
export class ApproveApplicationDto {
  @ApiPropertyOptional({
    description: 'Optional note about the approval decision',
    example: 'All documents verified. Application meets all requirements.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

/**
 * DTO for rejecting an application
 */
export class RejectApplicationDto {
  @ApiProperty({
    description: 'Reason for rejection (required)',
    example: 'Documents provided are expired or illegible.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(2000)
  reason: string;
}

/**
 * DTO for requesting additional documents
 */
export class RequestDocumentsDto {
  @ApiProperty({
    description: 'Instructions or reason for requesting additional documents',
    example: 'Please provide a clearer scan of your passport photo page.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(10, { message: 'Instructions must be at least 10 characters' })
  @MaxLength(2000)
  note: string;

  @ApiPropertyOptional({
    description: 'List of specific document type keys requested',
    example: ['passport_photo', 'proof_of_address'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentTypeKeys?: string[];
}

/**
 * DTO for generic admin status update (for extensibility)
 */
export class AdminStatusUpdateDto {
  @ApiProperty({
    description: 'New status for the application',
    example: 'IN_REVIEW',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Note explaining the status change',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
