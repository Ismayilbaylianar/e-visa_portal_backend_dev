import { Injectable, Scope } from '@nestjs/common';
import { Request } from 'express';

export interface RequestContext {
  requestId: string;
  ipAddress: string;
  userAgent: string;
  method: string;
  path: string;
  timestamp: Date;
}

/**
 * Request Context Service
 *
 * Provides access to request metadata like IP, User-Agent, etc.
 * Handles proxy scenarios (X-Forwarded-For, X-Real-IP).
 *
 * Scoped per request to maintain isolation.
 */
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  private context: RequestContext;

  /**
   * Initialize context from Express request
   */
  initFromRequest(request: Request): void {
    this.context = {
      requestId: (request as any).requestId || 'unknown',
      ipAddress: this.extractIpAddress(request),
      userAgent: this.extractUserAgent(request),
      method: request.method,
      path: request.path,
      timestamp: new Date(),
    };
  }

  /**
   * Get the current request context
   */
  getContext(): RequestContext {
    return this.context || this.getDefaultContext();
  }

  /**
   * Get client IP address
   */
  getIpAddress(): string {
    return this.context?.ipAddress || 'unknown';
  }

  /**
   * Get client User-Agent
   */
  getUserAgent(): string {
    return this.context?.userAgent || 'unknown';
  }

  /**
   * Get request ID
   */
  getRequestId(): string {
    return this.context?.requestId || 'unknown';
  }

  /**
   * Extract real client IP considering proxies
   * Priority: X-Forwarded-For > X-Real-IP > CF-Connecting-IP > socket
   */
  private extractIpAddress(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const forwarded = Array.isArray(xForwardedFor) ? xForwardedFor[0] : xForwardedFor;
      const firstIp = forwarded.split(',')[0].trim();
      if (firstIp) return firstIp;
    }

    const xRealIp = request.headers['x-real-ip'];
    if (xRealIp) {
      return Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
    }

    const cfConnectingIp = request.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Extract User-Agent with length limit
   */
  private extractUserAgent(request: Request): string {
    const ua = request.headers['user-agent'];
    if (!ua) return 'unknown';
    const agent = Array.isArray(ua) ? ua[0] : ua;
    return agent.substring(0, 500);
  }

  private getDefaultContext(): RequestContext {
    return {
      requestId: 'unknown',
      ipAddress: 'unknown',
      userAgent: 'unknown',
      method: 'unknown',
      path: 'unknown',
      timestamp: new Date(),
    };
  }
}
