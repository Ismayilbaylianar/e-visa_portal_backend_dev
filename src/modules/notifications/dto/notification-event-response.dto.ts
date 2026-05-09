import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationEventResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ example: 'app.submitted' }) eventType: string;
  @ApiProperty({ example: 'activity', enum: ['alert', 'activity'] }) severity: string;
  @ApiProperty({ example: 'activity', enum: ['alerts', 'activity'] }) channel: string;
  @ApiProperty() title: string;
  @ApiProperty() body: string;
  @ApiPropertyOptional({ type: Object }) contextJson?: any;
  @ApiProperty({ example: 'sent', enum: ['pending', 'sent', 'failed', 'skipped'] }) status: string;
  @ApiProperty({ example: 0 }) attemptCount: number;
  @ApiPropertyOptional() lastError?: string;
  @ApiPropertyOptional() sentAt?: Date;
  @ApiProperty() createdAt: Date;
}

export class NotificationStatsResponseDto {
  @ApiProperty({ description: 'Alerts in the last 24 hours' }) alerts24h: number;
  @ApiProperty({ description: 'Activity entries in the last 24 hours' }) activity24h: number;
  @ApiProperty({ description: 'Failed deliveries in the last 24 hours' }) failed24h: number;
  @ApiProperty({ description: 'Skipped (kill-switch off / event toggled off) in the last 24 hours' }) skipped24h: number;
  @ApiProperty({ description: 'telegram.enabled config flag — informational' }) telegramEnabled: boolean;
  /**
   * M11.5.1 — Twin-bot architecture. Each channel has its own bot
   * + token; both flags are independent so the UI banner can show
   * which (if any) is missing without exposing the tokens.
   */
  @ApiProperty({ description: 'Whether TELEGRAM_ALERTS_BOT_TOKEN is set on the server' }) alertsBotConfigured: boolean;
  @ApiProperty({ description: 'Whether TELEGRAM_ACTIVITY_BOT_TOKEN is set on the server' }) activityBotConfigured: boolean;
  @ApiProperty({
    description: 'Top event types in the last 24 hours, sorted by count desc.',
    type: 'array',
    items: { type: 'object' },
  })
  byEventType: Array<{ eventType: string; count: number }>;
}

export class NotificationSettingResponseDto {
  @ApiProperty() eventType: string;
  @ApiProperty() enabled: boolean;
  @ApiProperty({ example: 'activity' }) channel: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() updatedAt: Date;
}
