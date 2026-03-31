/**
 * Standard API response types
 */

export interface ApiResponseMeta {
  requestId: string;
  timestamp?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorDetail {
  field?: string;
  reason: string;
  message: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T | null;
  meta: ApiResponseMeta;
  error: ApiError | null;
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorResponse extends ApiResponse<null> {
  success: false;
  data: null;
  error: ApiError;
}

export interface PaginatedData<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginatedResponse<T> extends ApiSuccessResponse<T[]> {
  meta: ApiResponseMeta & {
    pagination: PaginationMeta;
  };
}
