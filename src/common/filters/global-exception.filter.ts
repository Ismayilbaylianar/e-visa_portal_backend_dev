import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exceptions';
import { ErrorCodes } from '../constants';
import { ApiErrorResponse, ApiErrorDetail } from '../types';
import { NotificationEmitterService } from '../../modules/notifications/notification-emitter.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    // M11.5 — optional so the existing `new GlobalExceptionFilter()`
    // bootstrap in main.ts keeps compiling. When wired through
    // `APP_FILTER` instead, Nest injects the real emitter.
    @Optional()
    private readonly notificationEmitter?: NotificationEmitterService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request as any).requestId || 'unknown';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: ApiErrorDetail[] | undefined;

    if (exception instanceof BaseException) {
      statusCode = exception.getStatus();
      errorCode = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as Record<string, unknown>;

        // Handle NestJS validation pipe errors
        if (Array.isArray(responseObj.message)) {
          errorCode = ErrorCodes.VALIDATION_ERROR;
          message = 'Validation failed';
          details = this.formatValidationErrors(responseObj.message as string[]);
        } else {
          message = (responseObj.message as string) || exception.message;
          errorCode = this.mapHttpStatusToErrorCode(statusCode);
        }
      } else {
        message = exception.message;
        errorCode = this.mapHttpStatusToErrorCode(statusCode);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      data: null,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
      error: {
        code: errorCode,
        message,
        details,
      },
    };

    // Log error
    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} - ${statusCode} - ${message}`,
    );

    // M11.5 — surface 5xx to the Alerts Telegram channel + admin
    // feed. We deliberately strip the stack trace before sending —
    // server logs already have it; Telegram is one-step-from-public.
    if (statusCode >= 500 && this.notificationEmitter) {
      const userIdFromAuth = (request as any).user?.id;
      void this.notificationEmitter.emit('system.error_5xx', {
        method: request.method,
        path: request.originalUrl ?? request.url,
        status: statusCode,
        message,
        requestId,
        userId: userIdFromAuth,
        ip: (request.headers['x-forwarded-for'] as string) ?? request.ip,
      });
    }

    response.status(statusCode).json(errorResponse);
  }

  private formatValidationErrors(messages: string[]): ApiErrorDetail[] {
    return messages.map(msg => {
      // Try to extract field name from validation message
      const fieldMatch = msg.match(/^(\w+)\s/);
      const field = fieldMatch ? fieldMatch[1] : undefined;

      return {
        field,
        reason: 'validationFailed',
        message: msg,
      };
    });
  }

  private mapHttpStatusToErrorCode(status: HttpStatus): string {
    const statusMap: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ErrorCodes.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCodes.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ErrorCodes.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ErrorCodes.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCodes.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCodes.UNPROCESSABLE_ENTITY,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCodes.TOO_MANY_REQUESTS,
      [HttpStatus.INTERNAL_SERVER_ERROR]: ErrorCodes.INTERNAL_SERVER_ERROR,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCodes.SERVICE_UNAVAILABLE,
    };

    return statusMap[status] || ErrorCodes.INTERNAL_SERVER_ERROR;
  }
}
