import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseException } from '../exceptions';
import { ErrorCodes } from '../constants';
import { ApiErrorResponse, ApiErrorDetail } from '../types';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

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
