import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GeoLookupResponseDto {
  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'US',
  })
  countryCode: string;

  @ApiProperty({
    description: 'Country name',
    example: 'United States',
  })
  countryName: string;
}
