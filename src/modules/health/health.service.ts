import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthResponseDto } from './dto';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness check - confirms the application is running
   * Used by Kubernetes/Docker for liveness probes
   */
  async checkLive(): Promise<HealthResponseDto> {
    return {
      status: 'ok',
      checks: {
        app: 'ok',
      },
    };
  }

  /**
   * Readiness check - confirms the application is ready to receive traffic
   * Includes database connectivity check
   * Used by Kubernetes/Docker for readiness probes
   */
  async checkReady(): Promise<HealthResponseDto> {
    const checks: HealthResponseDto['checks'] = {
      app: 'ok',
    };

    // Check database connectivity
    const isDatabaseHealthy = await this.prisma.isHealthy();
    checks.database = isDatabaseHealthy ? 'ok' : 'error';

    // Determine overall status
    const allChecksOk = Object.values(checks).every(status => status === 'ok');
    const anyCheckFailed = Object.values(checks).some(status => status === 'error');

    let status: HealthResponseDto['status'] = 'ok';
    if (anyCheckFailed) {
      status = 'error';
    } else if (!allChecksOk) {
      status = 'degraded';
    }

    return {
      status,
      checks,
    };
  }
}
