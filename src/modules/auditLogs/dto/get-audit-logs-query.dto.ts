import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto';

export class GetAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by actor user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action key',
    example: 'USER_CREATED',
  })
  @IsOptional()
  @IsString()
  actionKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    example: 'User',
  })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Filter from date',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter to date',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
