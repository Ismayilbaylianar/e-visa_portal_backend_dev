import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;

  @ApiProperty({ example: 10 })
  totalPages: number;
}

export class ApiResponseMetaDto {
  @ApiProperty({ example: 'req_abc123xyz' })
  requestId: string;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00.000Z' })
  timestamp?: string;

  @ApiPropertyOptional({ type: PaginationMetaDto })
  pagination?: PaginationMetaDto;
}

export class ApiErrorDetailDto {
  @ApiPropertyOptional({ example: 'email' })
  field?: string;

  @ApiProperty({ example: 'invalidFormat' })
  reason: string;

  @ApiProperty({ example: 'Email format is invalid' })
  message: string;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'validationError' })
  code: string;

  @ApiProperty({ example: 'Validation failed' })
  message: string;

  @ApiPropertyOptional({ type: [ApiErrorDetailDto] })
  details?: ApiErrorDetailDto[];
}

export class ApiSuccessResponseDto<T> {
  @ApiProperty({ example: true })
  success: true;

  @ApiProperty()
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
