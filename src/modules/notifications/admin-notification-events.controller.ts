import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PermissionsGuard } from '@/common/guards/permissions.guard';
import { CurrentUser, RequirePermissions } from '@/common/decorators';
import type { AuthenticatedUser } from '@/common/types/request.type';
import { NotificationEventsService } from './notification-events.service';
import {
  GetNotificationEventsQueryDto,
  NotificationEventResponseDto,
  NotificationSettingResponseDto,
  NotificationStatsResponseDto,
  TestNotificationDto,
  UpdateNotificationSettingDto,
} from './dto';

/**
 * M11.5 — admin endpoints for the Telegram event log.
 *
 * Mounted at `/admin/notification-events` to avoid colliding with
 * the older `/admin/notifications` controller (email log). The
 * frontend page can still live at `/admin/notifications`; URL routes
 * on the SPA are independent of API routes.
 *
 * Every endpoint requires the `notifications.manage` permission,
 * which the seed grants to the superAdmin role only.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('admin/notification-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminNotificationEventsController {
  constructor(private readonly service: NotificationEventsService) {}

  @Get()
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'List notification events (twin-feed, paginated)' })
  @ApiResponse({ status: 200, type: NotificationEventResponseDto, isArray: true })
  async list(@Query() query: GetNotificationEventsQueryDto) {
    return this.service.list(query);
  }

  @Get('stats')
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'Notification stats over the last 24 hours' })
  @ApiResponse({ status: 200, type: NotificationStatsResponseDto })
  async stats(): Promise<NotificationStatsResponseDto> {
    return this.service.stats();
  }

  @Post('test')
  @RequirePermissions('notifications.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test message to one of the Telegram channels' })
  async sendTest(
    @Body() dto: TestNotificationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return this.service.sendTest(
      dto,
      user.id,
      this.extractIp(req),
      req.headers['user-agent'],
    );
  }

  @Get('settings')
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'List per-event-type notification toggles' })
  @ApiResponse({ status: 200, type: NotificationSettingResponseDto, isArray: true })
  async listSettings(): Promise<NotificationSettingResponseDto[]> {
    return this.service.listSettings();
  }

  @Patch('settings/:eventType')
  @RequirePermissions('notifications.manage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Toggle notifications for a single event type' })
  @ApiResponse({ status: 200, type: NotificationSettingResponseDto })
  async updateSetting(
    @Param('eventType') eventType: string,
    @Body() dto: UpdateNotificationSettingDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<NotificationSettingResponseDto> {
    return this.service.updateSetting(
      eventType,
      dto,
      user.id,
      this.extractIp(req),
      req.headers['user-agent'],
    );
  }

  private extractIp(req: Request): string {
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const f = Array.isArray(xff) ? xff[0] : xff;
      return f.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }
}
