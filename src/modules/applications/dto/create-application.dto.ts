import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class CreateApplicationDto {
  @ApiProperty({
    description: 'Nationality country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  nationalityCountryId: string;

  @ApiProperty({
    description: 'Destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  visaTypeId: string;

  @ApiProperty({
    description: 'Template binding ID (from public selection preview)',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  templateBindingId: string;

  @ApiPropertyOptional({
    description: 'Whether expedited processing is requested',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  expedited?: boolean;
}
