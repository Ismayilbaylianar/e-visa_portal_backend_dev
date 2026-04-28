import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn, IsInt, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetEmailTemplatesQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — the admin email templates
   * grid uses limit=200 across all module list screens (Modul 1.5 / 2
   * convention). The catalogue is small (~5–20 rows) and renders fine
   * on a single page with client-side filtering.
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
   * Override parent default (sortBy=createdAt, sortOrder=desc) — the
   * admin email templates list reads better alphabetised by templateKey.
   * Service-level destructure defaults are overridden by the parent
   * instance values, so we must set them on the DTO itself.
   */
  @ApiPropertyOptional({
    description: 'Field to sort by',
    default: 'templateKey',
    example: 'templateKey',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'templateKey';

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
    description: 'Search by template key or subject',
    example: 'application',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
