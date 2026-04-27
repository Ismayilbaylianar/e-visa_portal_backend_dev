import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetCountriesQueryDto extends PaginationQueryDto {
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
