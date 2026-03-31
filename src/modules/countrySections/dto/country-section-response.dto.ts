import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CountrySectionResponseDto {
  @ApiProperty({
    description: 'Section UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Country UUID this section belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  countryId: string;

  @ApiProperty({
    description: 'Section title',
    example: 'Visa Requirements',
  })
  title: string;

  @ApiProperty({
    description: 'Section content',
    example: '<p>You need a valid passport...</p>',
  })
  content: string;

  @ApiProperty({
    description: 'Sort order for display',
    example: 1,
  })
  sortOrder: number;

  @ApiProperty({
    description: 'Whether the section is active',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
