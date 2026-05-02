import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetRolesQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — the admin Roles grid uses
   * limit=200 (Modul 2 lesson). The role count is tiny (<20 typical)
   * and the admin UI renders the full set with client-side filtering.
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
   * Override parent default (sortBy=createdAt, sortOrder=desc) —
   * roles render alphabetically by name in admin dropdowns.
   */
  @ApiPropertyOptional({ description: 'Field to sort by', default: 'name', example: 'name' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({
    description: 'Filter by system role status',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name or key',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
