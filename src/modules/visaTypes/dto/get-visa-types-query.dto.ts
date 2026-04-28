import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsIn, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { VisaEntryType } from '@prisma/client';
import { PaginationQueryDto } from '@/common/dto';

export class GetVisaTypesQueryDto extends PaginationQueryDto {
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
