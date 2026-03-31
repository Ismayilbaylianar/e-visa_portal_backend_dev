import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1, description: 'Current page number' })
  page: number;

  @ApiProperty({ example: 10, description: 'Items per page' })
  limit: number;

  @ApiProperty({ example: 100, description: 'Total number of items' })
  total: number;

  @ApiProperty({ example: 10, description: 'Total number of pages' })
  totalPages: number;
}

export class ApiResponseMetaDto {
  @ApiProperty({ example: 'req_abc123xyz', description: 'Unique request identifier' })
  requestId: string;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z', description: 'Response timestamp' })
  timestamp?: string;

  @ApiPropertyOptional({ type: PaginationMetaDto, description: 'Pagination information' })
  pagination?: PaginationMetaDto;
}

export class ApiErrorDetailDto {
  @ApiPropertyOptional({ example: 'email', description: 'Field name that caused the error' })
  field?: string;

  @ApiProperty({ example: 'invalidFormat', description: 'Error reason code' })
  reason: string;

  @ApiProperty({ example: 'Email format is invalid', description: 'Human-readable error message' })
  message: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'validationError', description: 'Error code' })
  code: string;

  @ApiProperty({ example: 'Validation failed', description: 'Error message' })
  message: string;

  @ApiPropertyOptional({ type: [ApiErrorDetailDto], description: 'Detailed error information' })
  details?: ApiErrorDetailDto[];
}

export class ApiSuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty({ description: 'Response data' })
  data: T;

  @ApiProperty({ type: ApiResponseMetaDto })
  meta: ApiResponseMetaDto;

  @ApiProperty({ example: null, nullable: true })
  error: null;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ example: null, nullable: true })
  data: null;

  @ApiProperty({ type: ApiResponseMetaDto })
  meta: ApiResponseMetaDto;

  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;
}
