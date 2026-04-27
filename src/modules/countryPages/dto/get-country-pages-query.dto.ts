import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetCountryPagesQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — country page list is small
   * (one page per country max) and the admin screen wants to render
   * everything in a single grid for now.
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
   * Override parent default (createdAt desc) — for the publishable list
   * default to alphabetical by slug so the admin sees a stable order.
   */
  @ApiPropertyOptional({ description: 'Field to sort by', default: 'slug', example: 'slug' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'slug';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  @ApiPropertyOptional({ description: 'Filter by isActive' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by isPublished' })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ description: 'Filter by underlying country UUID' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Search by slug or country name', example: 'turk' })
  @IsOptional()
  @IsString()
  search?: string;
}
