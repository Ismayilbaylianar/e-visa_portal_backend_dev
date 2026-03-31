import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { SearchQueryDto } from '@/common/dto';

export class GetRolesQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by system role status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isSystem?: boolean;
}
