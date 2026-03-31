import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  IsDecimal,
} from 'class-validator';

export class CreateBindingNationalityFeeDto {
  @ApiProperty({
    description: 'Nationality country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Government fee amount',
    example: '50.00',
  })
  @IsDecimal({ decimal_digits: '0,2' })
  governmentFeeAmount: string;

  @ApiProperty({
    description: 'Service fee amount',
    example: '25.00',
  })
  @IsDecimal({ decimal_digits: '0,2' })
  serviceFeeAmount: string;

  @ApiPropertyOptional({
    description: 'Expedited fee amount',
    example: '30.00',
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: '0,2' })
  expeditedFeeAmount?: string;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
  })
  @IsString()
  @Length(3, 3)
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
