import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the request ID from the request
 */
export const RequestId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.requestId || 'unknown';
  },
);
