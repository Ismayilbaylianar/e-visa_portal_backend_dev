import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'], description: 'Application status' })
  app: 'ok' | 'error';

  @ApiProperty({ example: 'ok', enum: ['ok', 'error'], description: 'Database connection status' })
  database?: 'ok' | 'error';
}

export class HealthResponseDto {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'degraded', 'error'],
    description: 'Overall system status',
  })
  status: 'ok' | 'degraded' | 'error';

  @ApiProperty({ type: HealthCheckDto, description: 'Individual component checks' })
  checks: HealthCheckDto;

  @ApiProperty({ example: '1.0.0', description: 'Application version' })
  version: string;

  @ApiProperty({ example: '2024-01-15T10:30:00.000Z', description: 'Server timestamp' })
  timestamp: string;
}
