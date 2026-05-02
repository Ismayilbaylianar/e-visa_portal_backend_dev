import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetUsersQueryDto extends PaginationQueryDto {
  /**
   * Override the parent MAX_LIMIT (=100) — the admin Users grid uses
   * limit=200 across module list screens (Modul 2 lesson). The user
   * count is small (<50 typical) and the admin UI renders the full
   * set on a single page with client-side filtering.
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
   * keep the most recently created user at the top, matches the
   * audit-trail mental model for UAM.
   */
  @ApiPropertyOptional({ description: 'Field to sort by', default: 'createdAt', example: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;

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
    description: 'Search by name or email',
    example: 'john',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
