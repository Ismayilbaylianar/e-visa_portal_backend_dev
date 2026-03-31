import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisaEntryType } from '@prisma/client';

export class VisaTypeResponseDto {
  @ApiProperty({
    description: 'Visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Purpose of the visa',
    example: 'Tourism',
  })
  purpose: string;

  @ApiProperty({
    description: 'Validity period in days',
    example: 30,
  })
  validityDays: number;

  @ApiProperty({
    description: 'Maximum stay duration in days',
    example: 30,
  })
  maxStay: number;

  @ApiProperty({
    description: 'Entry type for the visa',
    enum: VisaEntryType,
    example: VisaEntryType.SINGLE,
  })
  entries: VisaEntryType;

  @ApiProperty({
    description: 'Display label for the visa type',
    example: 'Tourist Visa - 30 Days',
  })
  label: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the visa type',
    example: 'Standard tourist visa for leisure travel',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether the visa type is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Sort order for display purposes',
    example: 0,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
