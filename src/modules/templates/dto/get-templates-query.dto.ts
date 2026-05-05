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
  // Nest's global ValidationPipe runs with `enableImplicitConversion:
  // true`, which uses `Boolean(value)` to coerce strings BEFORE this
  // @Transform fires. That would turn the string "false" into the
  // boolean `true` (any non-empty string is truthy). To recover the
  // user's actual intent we re-read the raw value from `obj[key]`,
  // which class-transformer leaves as the original query-string value.
  @Transform(({ value, obj, key }) => coerceBoolean(obj?.[key] ?? value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description:
      'M11.2 — filter by boilerplate flag. Pass `true` from the admin "Create from boilerplate" picker to show only blueprint templates; pass `false` to hide them from the regular admin list.',
  })
  @IsOptional()
  @Transform(({ value, obj, key }) => coerceBoolean(obj?.[key] ?? value))
  @IsBoolean()
  isBoilerplate?: boolean;
}

/**
 * Robust string→boolean for query params. Returns undefined for
 * unrecognized input so @IsOptional + @IsBoolean catches typos
 * instead of silently filtering by `false`.
 */
function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return undefined;
}
