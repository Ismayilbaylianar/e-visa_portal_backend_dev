import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

export class GetRolesQueryDto extends PaginationQueryDto {
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
