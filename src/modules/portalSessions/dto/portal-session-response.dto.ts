import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PortalSessionResponseDto {
  @ApiProperty({
    description: 'Session ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Portal identity ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  portalIdentityId: string;

  @ApiPropertyOptional({
    description: 'IP address of the session',
    example: '192.168.1.1',
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent of the session',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  })
  userAgent?: string;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-01-22T10:30:00.000Z',
  })
  expiresAt: Date;

  @ApiProperty({
    description: 'Last activity timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  lastActivityAt: Date;

  @ApiProperty({
    description: 'Session creation timestamp',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'Session revocation timestamp',
    example: '2024-01-16T10:00:00.000Z',
  })
  revokedAt?: Date;
}
