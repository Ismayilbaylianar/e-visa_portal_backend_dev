import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ description: 'Session ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiPropertyOptional({ description: 'IP address' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  userAgent?: string;

  @ApiProperty({ description: 'Session expiration time' })
  expiresAt: Date;

  @ApiProperty({ description: 'Last activity time' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Session creation time' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Session revocation time' })
  revokedAt?: Date;

  @ApiProperty({ description: 'Whether this is the current session' })
  isCurrent: boolean;
}

export class CurrentSessionResponseDto {
  @ApiProperty({ description: 'Session ID' })
  id: string;

  @ApiProperty({ description: 'User information' })
  user: {
    id: string;
    email: string;
    fullName: string;
    roleId?: string;
    roleName?: string;
  };

  @ApiPropertyOptional({ description: 'IP address' })
  ipAddress?: string;

  @ApiPropertyOptional({ description: 'User agent' })
  userAgent?: string;

  @ApiProperty({ description: 'Session expiration time' })
  expiresAt: Date;

  @ApiProperty({ description: 'Last activity time' })
  lastActivityAt: Date;

  @ApiProperty({ description: 'Session creation time' })
  createdAt: Date;
}
