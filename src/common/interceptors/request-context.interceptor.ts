import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { RequestContextService } from '../services/request-context.service';
import { generateRequestId } from '../utils';

/**
 * Request Context Interceptor
 *
 * Initializes the request context service with request metadata.
 * Should run early in the interceptor chain.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    if (!(request as any).requestId) {
      (request as any).requestId =
        (request.headers['x-request-id'] as string) ||
        (request.headers['x-correlation-id'] as string) ||
        generateRequestId();
    }

    this.requestContext.initFromRequest(request);

    return next.handle();
  }
}
