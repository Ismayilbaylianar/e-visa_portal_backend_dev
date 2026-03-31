import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { SearchQueryDto } from '@/common/dto';

export class GetUsersQueryDto extends SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by role ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by email (partial match)',
  })
  @IsOptional()
  @IsString()
  email?: string;
}
