import { ApiProperty } from '@nestjs/swagger';
import { CountrySectionSlot } from '@prisma/client';

/**
 * NOTE: This file is *not* the response shape used by the live
 * controllers — both CountryPagesService and CountrySectionsService
 * import their response DTO from `modules/countries/dto/country-response.dto.ts`
 * (the legacy location). This file is kept as the documented schema
 * for the standalone section endpoints; keep it in sync with that
 * canonical DTO if you ever consolidate.
 */
export class CountrySectionResponseDto {
  @ApiProperty({
    description: 'Section UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

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
    description: 'Which card skin renders the section on the public page.',
    enum: CountrySectionSlot,
    example: CountrySectionSlot.REQUIREMENTS,
  })
  slot: CountrySectionSlot;

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
