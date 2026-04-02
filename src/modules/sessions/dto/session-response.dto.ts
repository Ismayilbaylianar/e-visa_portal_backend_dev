import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID', example: 'ses_1' })
  id: string;

  @ApiPropertyOptional({ description: 'IP address', example: '127.0.0.1' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent', example: 'Mozilla/5.0...' })
  userAgent?: string;

  @ApiProperty({ description: 'Session expiration time', example: '2026-03-31T12:00:00Z' })
  expiresAt: Date;

  @ApiProperty({ description: 'Last activity time', example: '2026-03-31T10:00:00Z' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Whether this is the current session', example: true })
  isCurrent: boolean;

  @ApiProperty({ description: 'Session creation time', example: '2026-03-31T09:00:00Z' })
  createdAt: Date;
}

export class SessionListResponseDto {
  @ApiProperty({ type: [SessionResponseDto], description: 'List of active sessions' })
  sessions: SessionResponseDto[];

  @ApiProperty({ description: 'Total number of active sessions', example: 3 })
  total: number;
}

export class RevokeAllSessionsResponseDto {
  @ApiProperty({ description: 'Number of sessions revoked', example: 5 })
  revokedCount: number;
}
