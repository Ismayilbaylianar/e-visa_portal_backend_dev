import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateBindingNationalityFeeDto {
  @ApiProperty({
    description: 'Nationality country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Government fee amount (decimal string, e.g., "20.00")',
    example: '20.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'governmentFeeAmount must be a valid decimal string (e.g., "20.00")',
  })
  governmentFeeAmount: string;

  @ApiProperty({
    description: 'Service fee amount (decimal string, e.g., "10.00")',
    example: '10.00',
  })
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'serviceFeeAmount must be a valid decimal string (e.g., "10.00")',
  })
  serviceFeeAmount: string;

  @ApiPropertyOptional({
    description: 'Expedited fee amount (decimal string, null if not enabled)',
    example: '15.00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'expeditedFeeAmount must be a valid decimal string (e.g., "15.00")',
  })
  expeditedFeeAmount?: string | null;

  @ApiProperty({
    description: 'Currency code (ISO 4217, 3 uppercase letters)',
    example: 'USD',
  })
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currencyCode must be 3 uppercase letters (ISO 4217)',
  })
  currencyCode: string;

  @ApiPropertyOptional({
    description: 'Whether expedited processing is enabled',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  expeditedEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the fee is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
