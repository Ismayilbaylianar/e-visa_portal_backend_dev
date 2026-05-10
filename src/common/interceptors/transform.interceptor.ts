import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
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
        // M11.12 (BUG K) — pass binary / streaming responses through
        // unchanged. The /api/v1/files/* route returns a
        // `StreamableFile`; without this guard the global wrapper
        // would JSON-encode the StreamableFile object as
        // `{success:true, data:{stream:..., logger:...}}`, which the
        // browser then receives with `Content-Type: image/jpeg` and
        // tries to render as an image — producing the long-standing
        // "preview tab opens then closes" symptom (3 prior fix
        // attempts patched controllers + signed URLs but never
        // noticed this interceptor was eating the body). Guard also
        // covers raw Buffer / ReadableStream returns so any future
        // download endpoint can opt in by simply returning the
        // right type.
        if (
          response instanceof StreamableFile ||
          Buffer.isBuffer(response) ||
          (response &&
            typeof (response as { pipe?: unknown }).pipe === 'function')
        ) {
          return response as unknown as ApiSuccessResponse<T>;
        }

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
