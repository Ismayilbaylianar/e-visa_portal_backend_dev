import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsUUID,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

/**
 * Parse a boolean query-string parameter from its raw value.
 *
 * Returning `undefined` for an absent/blank parameter matters: paired
 * with `@IsOptional()` it means "no filter", which is what the All tab
 * needs. Anything unrecognised is returned as-is so `@IsBoolean()`
 * rejects it with a 400 rather than being silently read as `false`.
 */
function parseBooleanParam(raw: unknown): boolean | undefined | unknown {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (raw === true || raw === 'true' || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === '0') return false;
  return raw;
}

export class GetTemplateBindingsQueryDto extends PaginationQueryDto {
  // Bindings are admin-managed reference data — the list is small
  // enough that the standard 100-cap forces unnecessary pagination on
  // an admin overview screen. Match the country/countryPages convention
  // and lift the cap to 500 so the admin can see all bindings on one
  // page (and so the stats row can compute "Active w/o fees" without
  // needing to walk every page).
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
    description:
      'Free-text search across template name/key, destination country name/ISO, and visa type label/purpose. Case-insensitive.',
    example: 'turkey',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  // Read the RAW query value off `obj`, not the `value` argument.
  //
  // The global ValidationPipe runs with `enableImplicitConversion`, and
  // class-transformer applies that conversion BEFORE any @Transform:
  // for a boolean-typed property it does `!!value`, so the string
  // 'false' arrives here already coerced to `true`. Comparing the
  // post-conversion `value` against strings therefore cannot
  // distinguish the two tabs no matter how it is written — which is
  // why `?isActive=false` was silently filtering on `isActive: true`.
  // `obj` still holds the untouched query string.
  @Transform(({ obj, key }) => parseBooleanParam(obj?.[key]))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by destination country ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  destinationCountryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by visa type ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  visaTypeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by template ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Include related entities in response',
    default: false,
  })
  @IsOptional()
  // Same implicit-conversion trap as `isActive` above.
  @Transform(({ obj, key }) => parseBooleanParam(obj?.[key]))
  @IsBoolean()
  includeRelations?: boolean;
}
