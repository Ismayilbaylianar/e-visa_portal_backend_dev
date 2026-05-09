import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * M11.5 — query params for `GET /admin/notification-events`. Distinct
 * from the existing `GetNotificationsQueryDto` (email log under
 * `/admin/notifications`) — Telegram event log lives at a separate
 * route to avoid colliding with the older module.
 */
export class GetNotificationEventsQueryDto {
  @ApiPropertyOptional({ enum: ['alert', 'activity'] })
  @IsOptional()
  @IsIn(['alert', 'activity'])
  severity?: 'alert' | 'activity';

  @ApiPropertyOptional({ enum: ['alerts', 'activity'] })
  @IsOptional()
  @IsIn(['alerts', 'activity'])
  channel?: 'alerts' | 'activity';

  @ApiPropertyOptional({ enum: ['pending', 'sent', 'failed', 'skipped'] })
  @IsOptional()
  @IsIn(['pending', 'sent', 'failed', 'skipped'])
  status?: 'pending' | 'sent' | 'failed' | 'skipped';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

export class TestNotificationDto {
  @ApiPropertyOptional({ enum: ['alerts', 'activity'], default: 'alerts' })
  @IsOptional()
  @IsIn(['alerts', 'activity'])
  channel?: 'alerts' | 'activity';
}

export class UpdateNotificationSettingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'boolean'
      ? value
      : typeof value === 'string'
        ? ['true', '1', 'yes'].includes(value.toLowerCase())
        : Boolean(value),
  )
  @IsBoolean()
  enabled: boolean;
}
