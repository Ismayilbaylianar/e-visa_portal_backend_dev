import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Custom Throttler Guard that handles proxy scenarios
 *
 * Extracts real client IP from X-Forwarded-For or X-Real-IP headers.
 * Works correctly behind Nginx/load balancers.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      const firstIp = forwarded.split(',')[0].trim();
      if (firstIp) return firstIp;
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const message = `Too many requests. Please try again in ${Math.ceil(throttlerLimitDetail.timeToBlockExpire / 1000)} seconds.`;
    throw new ThrottlerException(message);
  }
}
