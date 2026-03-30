import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiSuccessResponse } from '../types';

export interface TransformResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T>> {
    const request = context.switchToHttp().getRequest<Request>();
    const requestId = (request as any).requestId || 'unknown';

    return next.handle().pipe(
      map(response => {
        // If response is already in the correct format, return as is
        if (response && typeof response === 'object' && 'success' in response) {
          return response;
        }

        // Handle paginated responses
        if (response && typeof response === 'object' && 'data' in response && 'meta' in response) {
          const transformedResponse = response as TransformResponse<T>;
          return {
            success: true as const,
            data: transformedResponse.data,
            meta: {
              requestId,
              timestamp: new Date().toISOString(),
              ...transformedResponse.meta,
            },
            error: null,
          };
        }

        // Standard response transformation
        return {
          success: true as const,
          data: response as T,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
          error: null,
        };
      }),
    );
  }
}
