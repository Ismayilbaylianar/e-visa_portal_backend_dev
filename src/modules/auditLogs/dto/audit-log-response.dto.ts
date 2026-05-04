import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({
    description: 'Audit log UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiPropertyOptional({
    description: 'User who performed the action',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  actorUserId?: string;

  @ApiPropertyOptional({
    description: 'Actor user details',
  })
  actorUser?: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiProperty({
    description: 'Action key identifier',
    example: 'USER_CREATED',
  })
  actionKey: string;

  @ApiProperty({
    description: 'Entity type affected',
    example: 'User',
  })
  entityType: string;

  @ApiPropertyOptional({
    description: 'Entity ID affected',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  entityId?: string;

  @ApiPropertyOptional({
    description:
      'Snapshot of the entity BEFORE the action. Maps from `old_value_json` in the DB. May be null on `*.create` actions where there is no prior state.',
    type: 'object',
  })
  oldValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Snapshot of the entity AFTER the action. Maps from `new_value_json` in the DB. May be null on `*.delete` actions where there is no post state.',
    type: 'object',
  })
  newValue?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Actor type — USER for human admin actions, SYSTEM for cron / job / migration actions.',
    enum: ['USER', 'SYSTEM'],
    example: 'USER',
  })
  actorType?: 'USER' | 'SYSTEM';

  @ApiPropertyOptional({
    description: 'IP address of the request',
    example: '192.168.1.1',
  })
  ipAddress?: string;

  @ApiPropertyOptional({
    description: 'User agent string',
    example: 'Mozilla/5.0...',
  })
  userAgent?: string;

  @ApiProperty({
    description: 'Timestamp of the action',
    example: '2024-01-15T10:30:00.000Z',
  })
  createdAt: Date;
}
