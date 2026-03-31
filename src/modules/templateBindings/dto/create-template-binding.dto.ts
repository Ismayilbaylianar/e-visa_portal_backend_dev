import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateTemplateBindingDto {
  @ApiProperty({
    description: 'Destination country UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  destinationCountryId: string;

  @ApiProperty({
    description: 'Visa type UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  visaTypeId: string;

  @ApiProperty({
    description: 'Template UUID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  templateId: string;

  @ApiPropertyOptional({
    description: 'Whether the binding is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Date from which the binding is valid',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({
    description: 'Date until which the binding is valid',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  validTo?: string;
}
