import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '@/common/dto';
import { NotificationChannel, NotificationStatus } from '@prisma/client';

export class GetNotificationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by notification channel',
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Filter by notification status',
    enum: NotificationStatus,
  })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiPropertyOptional({
    description: 'Filter by template key',
    example: 'otp_verification',
  })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by recipient (email or phone)',
    example: 'user@example.com',
  })
  @IsOptional()
  @IsString()
  recipient?: string;

  @ApiPropertyOptional({
    description: 'Filter by date from',
    example: '2026-01-01',
  })
  @IsOptional()
  @Type(() => String)
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter by date to',
    example: '2026-12-31',
  })
  @IsOptional()
  @Type(() => String)
  dateTo?: string;
}
