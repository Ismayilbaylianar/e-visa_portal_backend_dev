import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  Matches,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';

/**
 * Module 8 — Audit log list filters.
 *
 * The audit log table grows fast (every mutation across the admin
 * surface emits a row) so we override the inherited limit cap from
 * 100 to 500 — same convention as countries / templateBindings /
 * templates list DTOs. Default stays low (50) because the UI loads a
 * page at a time and most uses are filtered drill-downs, not full
 * scans.
 *
 * Filter columns are all DB-indexed (see `@@index` declarations on
 * the AuditLog model: actorUserId, actionKey, entityType, entityId,
 * createdAt) so even unfiltered scans of large windows stay snappy.
 */
export class GetAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Items per page (1-500). Default 50.',
    minimum: 1,
    maximum: 500,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Filter by actor user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by exact action key (e.g. "settings.update", "role.create"). Use `actionKeyPrefix` for wildcards.',
    example: 'settings.update',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  actionKey?: string;

  @ApiPropertyOptional({
    description:
      'Filter by action key prefix (e.g. "application." matches application.create, application.approve, etc). When both `actionKey` and `actionKeyPrefix` are supplied, the prefix wins.',
    example: 'application.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/, {
    message: 'actionKeyPrefix must look like a partial action key',
  })
  actionKeyPrefix?: string;

  @ApiPropertyOptional({
    description:
      'Filter by entity type (e.g. "User", "Role", "Application"). Case-sensitive — entity types in the DB are PascalCase.',
    example: 'User',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityType?: string;

  @ApiPropertyOptional({
    description:
      'Filter by entity ID — the per-entity drill-down ("show every change to this application") uses this together with entityType.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Actor type filter — USER for admin actions, SYSTEM for cron/jobs',
    enum: ['USER', 'SYSTEM'],
    example: 'USER',
  })
  @IsOptional()
  @IsIn(['USER', 'SYSTEM'])
  actorType?: 'USER' | 'SYSTEM';

  @ApiPropertyOptional({
    description: 'Filter by createdAt >= this ISO datetime',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by createdAt <= this ISO datetime',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
