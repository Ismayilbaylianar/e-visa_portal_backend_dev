import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class JobResponseDto {
  @ApiProperty({
    description: 'Job UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Type of the job',
    example: 'EMAIL_SEND',
  })
  jobType: string;

  @ApiProperty({
    description: 'Current status of the job',
    example: 'PENDING',
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Job payload data',
    type: 'object',
  })
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Job result data',
    type: 'object',
  })
  result?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Error message if job failed',
    example: 'Connection timeout',
  })
  errorMessage?: string;

  @ApiProperty({
    description: 'Number of retry attempts',
    example: 0,
  })
  retryCount: number;

  @ApiProperty({
    description: 'Maximum retry attempts allowed',
    example: 3,
  })
  maxRetries: number;

  @ApiPropertyOptional({
    description: 'When the job started processing',
    example: '2024-01-15T10:30:00.000Z',
  })
  startedAt?: Date;

  @ApiPropertyOptional({
    description: 'When the job completed',
    example: '2024-01-15T10:31:00.000Z',
  })
  completedAt?: Date;

  @ApiProperty({
    description: 'When the job was created',
    example: '2024-01-15T10:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'When the job was last updated',
    example: '2024-01-15T10:31:00.000Z',
  })
  updatedAt: Date;
}
