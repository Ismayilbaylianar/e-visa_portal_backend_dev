import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GetFaqItemsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category (admin only — public groups all)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
