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
    description: 'Previous state before action',
    type: 'object',
  })
  oldData?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'New state after action',
    type: 'object',
  })
  newData?: Record<string, unknown>;

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
