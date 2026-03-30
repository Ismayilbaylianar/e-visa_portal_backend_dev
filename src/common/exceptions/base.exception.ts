import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorDetail } from '../types';
import { ErrorCode } from '../constants';

export interface BaseExceptionOptions {
  code: ErrorCode;
  message: string;
  statusCode?: HttpStatus;
  details?: ApiErrorDetail[];
}

export class BaseException extends HttpException {
  public readonly code: ErrorCode;
  public readonly details?: ApiErrorDetail[];

  constructor(options: BaseExceptionOptions) {
    const statusCode = options.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    super(options.message, statusCode);
    this.code = options.code;
    this.details = options.details;
  }
}
