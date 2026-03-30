import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { generateRequestId } from '../utils';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    // Use existing request ID from header or generate new one
    const requestId =
      (request.headers['x-request-id'] as string) ||
      (request.headers['x-correlation-id'] as string) ||
      generateRequestId();

    // Attach to request object for later use
    (request as any).requestId = requestId;

    return next.handle();
  }
}
