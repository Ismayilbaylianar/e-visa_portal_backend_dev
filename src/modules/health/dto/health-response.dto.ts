import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  app: 'ok' | 'error';

  @ApiProperty({ example: 'ok', enum: ['ok', 'error'], required: false })
  database?: 'ok' | 'error';
}

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'degraded', 'error'] })
  status: 'ok' | 'degraded' | 'error';

  @ApiProperty({ type: HealthCheckDto })
  checks: HealthCheckDto;
}
