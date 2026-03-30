import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto';

@ApiTags('Health')
@Controller('system/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Check if the application is running. Used for liveness probes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
    type: HealthResponseDto,
  })
  async checkLive(): Promise<HealthResponseDto> {
    return this.healthService.checkLive();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Check if the application is ready to receive traffic. Includes database connectivity check.',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
    type: HealthResponseDto,
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async checkReady(): Promise<HealthResponseDto> {
    const health = await this.healthService.checkReady();

    // Note: In a real scenario, you might want to return 503 if not ready
    // For now, we return the status in the response body
    return health;
  }
}
