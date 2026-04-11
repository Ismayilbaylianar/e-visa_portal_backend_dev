import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationResponseDto, GetNotificationsQueryDto } from './dto';
import { NotificationIdParamDto } from '@/common/dto';
import { ApiPaginatedResponse } from '@/common/decorators';
import { JwtAuthGuard } from '@/common/guards';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all notifications',
    description:
      'Get paginated list of notifications with optional filters (channel, status, templateKey, recipient)',
  })
  @ApiPaginatedResponse(NotificationResponseDto)
  async findAll(@Query() query: GetNotificationsQueryDto) {
    return this.notificationsService.findAll(query);
  }

  @Get(':notificationId')
  @ApiOperation({
    summary: 'Get notification by ID',
    description: 'Get notification details by ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification details',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async findById(@Param() params: NotificationIdParamDto): Promise<NotificationResponseDto> {
    return this.notificationsService.findById(params.notificationId);
  }

  @Post(':notificationId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry a notification',
    description: `Retry a failed or pending notification.

**Behavior:**
- Only FAILED or PENDING notifications can be retried
- Increments retry count
- Resets status to PENDING
- Maximum retry attempts enforced (default: 3)

**Mock Mode:**
- In development, notification is marked as SENT after ~1 second
- In production, this would trigger actual SMTP/SMS/Push sending`,
  })
  @ApiResponse({
    status: 200,
    description: 'Notification queued for retry',
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Notification cannot be retried (wrong status or max retries reached)',
  })
  @ApiResponse({
    status: 404,
    description: 'Notification not found',
  })
  async retry(@Param() params: NotificationIdParamDto): Promise<NotificationResponseDto> {
    return this.notificationsService.retry(params.notificationId);
  }
}
