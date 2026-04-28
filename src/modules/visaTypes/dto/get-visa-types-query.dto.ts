import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn, IsInt, IsString, IsEnum, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { VisaEntryType } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto';

export class GetVisaTypesQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — admin frontend uses limit=200
   * across all module list screens (countries / countryPages / visaTypes
   * follow the same pattern). The visa types catalogue is small (~10–30
   * rows) and the admin grid wants to render everything on one page with
   * client-side filtering.
   */
  @ApiPropertyOptional({
    description: 'Items per page. Up to 500 for this list.',
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

  /**
   * Override parent default (sortBy=createdAt, sortOrder=desc) — visa
   * types render in admin/public dropdowns ordered by editorial sortOrder
   * (lowest first). Falling back to alphabetical-by-creation-date would
   * shuffle dropdowns whenever a new offering was added.
   */
  @ApiPropertyOptional({ description: 'Field to sort by', default: 'sortOrder', example: 'sortOrder' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'sortOrder';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

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
    description: 'Filter by entry type',
    enum: VisaEntryType,
    example: 'SINGLE',
  })
  @IsOptional()
  @IsEnum(VisaEntryType)
  entries?: VisaEntryType;

  @ApiPropertyOptional({
    description: 'Search by purpose or label',
    example: 'tourism',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
