import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class SelectionPreviewRequestDto {
  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  @IsNotEmpty()
  visaTypeId: string;

  @ApiPropertyOptional({
    description: 'Whether expedited processing is requested',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  expedited?: boolean;
}

export class FeeBreakdownDto {
  @ApiProperty({
    description: 'Government fee amount',
    example: '50.00',
  })
  governmentFee: string;

  @ApiProperty({
    description: 'Service fee amount',
    example: '25.00',
  })
  serviceFee: string;

  @ApiPropertyOptional({
    description: 'Expedited processing fee amount',
    example: '30.00',
  })
  expeditedFee?: string;

  @ApiProperty({
    description: 'Total fee amount',
    example: '75.00',
  })
  totalFee: string;

  @ApiProperty({
    description: 'Currency code',
    example: 'USD',
  })
  currencyCode: string;
}

export class SelectionPreviewResponseDto {
  @ApiProperty({
    description: 'Whether the combination is available',
    example: true,
  })
  available: boolean;

  @ApiPropertyOptional({
    description: 'Fee breakdown',
    type: FeeBreakdownDto,
  })
  feeBreakdown?: FeeBreakdownDto;

  @ApiPropertyOptional({
    description: 'Whether expedited processing is available',
    example: true,
  })
  expeditedAvailable?: boolean;

  @ApiPropertyOptional({
    description: 'Standard processing time in days',
    example: 7,
  })
  processingDays?: number;

  @ApiPropertyOptional({
    description: 'Expedited processing time in days',
    example: 3,
  })
  expeditedProcessingDays?: number;

  @ApiPropertyOptional({
    description: 'Message if combination is not available',
    example: 'This visa type is not available for your nationality',
  })
  message?: string;
}
