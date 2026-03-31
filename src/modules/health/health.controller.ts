import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { Public } from '@/common/decorators';

@ApiTags('Health')
@Controller('system/health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @Public()
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
  @Public()
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
    return this.healthService.checkReady();
  }
}
