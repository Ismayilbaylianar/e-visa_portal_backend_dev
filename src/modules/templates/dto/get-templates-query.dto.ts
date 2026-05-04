import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SearchQueryDto } from '@/common/dto';

export class GetTemplatesQueryDto extends SearchQueryDto {
  // Templates are admin-managed reference data — the list is small
  // enough that the global 100-cap forces unnecessary pagination on
  // the admin overview screen (which loads `limit=200` to show stats
  // + table on one page). Match the cap-lift convention already in
  // place on countries / countryPages / templateBindings / visaTypes /
  // emailTemplates / users / roles list DTOs.
  @ApiPropertyOptional({
    description: 'Items per page (1-500)',
    minimum: 1,
    maximum: 500,
    default: 50,
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'M11.2 — filter by boilerplate flag. Pass `true` from the admin "Create from boilerplate" picker to show only blueprint templates; pass `false` to hide them from the regular admin list.',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isBoilerplate?: boolean;
}
