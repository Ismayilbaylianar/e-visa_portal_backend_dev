import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ErrorCodes } from '../constants';
import { ApiErrorDetail } from '../types';

export class BadRequestException extends BaseException {
  constructor(message = 'Bad request', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.BAD_REQUEST,
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      details,
    });
  }
}

export class ValidationException extends BaseException {
  constructor(message = 'Validation failed', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.VALIDATION_ERROR,
      message,
      statusCode: HttpStatus.BAD_REQUEST,
      details,
    });
  }
}

export class UnauthorizedException extends BaseException {
  constructor(message = 'Unauthorized', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.UNAUTHORIZED,
      message,
      statusCode: HttpStatus.UNAUTHORIZED,
      details,
    });
  }
}

export class ForbiddenException extends BaseException {
  constructor(message = 'Forbidden', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.FORBIDDEN,
      message,
      statusCode: HttpStatus.FORBIDDEN,
      details,
    });
  }
}

export class NotFoundException extends BaseException {
  constructor(message = 'Resource not found', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.NOT_FOUND,
      message,
      statusCode: HttpStatus.NOT_FOUND,
      details,
    });
  }
}

export class ConflictException extends BaseException {
  constructor(message = 'Conflict', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.CONFLICT,
      message,
      statusCode: HttpStatus.CONFLICT,
      details,
    });
  }
}

export class InternalServerErrorException extends BaseException {
  constructor(message = 'Internal server error', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    });
  }
}

export class ServiceUnavailableException extends BaseException {
  constructor(message = 'Service unavailable', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      message,
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      details,
    });
  }
}

export class DatabaseException extends BaseException {
  constructor(message = 'Database error', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.DATABASE_ERROR,
      message,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      details,
    });
  }
}

export class TooManyRequestsException extends BaseException {
  constructor(message = 'Too many requests', details?: ApiErrorDetail[]) {
    super({
      code: ErrorCodes.TOO_MANY_REQUESTS,
      message,
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      details,
    });
  }
}
