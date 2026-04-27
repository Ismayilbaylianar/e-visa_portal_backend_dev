import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, IsString, Matches, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetCountriesQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — the countries reference table
   * holds 250 ISO 3166-1 rows and the admin "All countries" screen wants
   * to render the full set on a single page (with client-side filtering).
   */
  @ApiPropertyOptional({
    description: 'Items per page. Up to 500 for the reference list.',
    minimum: 1,
    maximum: 500,
    default: 50,
    example: 300,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by continent (AF / AS / EU / NA / SA / OC / AN)',
    example: 'AS',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(AF|AS|EU|NA|SA|OC|AN)$/, {
    message: 'continentCode must be one of AF, AS, EU, NA, SA, OC, AN',
  })
  continentCode?: string;

  @ApiPropertyOptional({
    description:
      'When true, returns only countries that have a CountryPage. Useful for admin pickers when creating bindings or pages.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  hasPage?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name or ISO code',
    example: 'turkey',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
