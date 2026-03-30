/**
 * Application error codes
 * Used for consistent error identification across the API
 */
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'badRequest',
  VALIDATION_ERROR: 'validationError',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  UNPROCESSABLE_ENTITY: 'unprocessableEntity',
  TOO_MANY_REQUESTS: 'tooManyRequests',

  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'internalServerError',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  DATABASE_ERROR: 'databaseError',
  EXTERNAL_SERVICE_ERROR: 'externalServiceError',

  // Authentication errors
  INVALID_CREDENTIALS: 'invalidCredentials',
  TOKEN_EXPIRED: 'tokenExpired',
  TOKEN_INVALID: 'tokenInvalid',
  REFRESH_TOKEN_EXPIRED: 'refreshTokenExpired',
  REFRESH_TOKEN_INVALID: 'refreshTokenInvalid',

  // Business logic errors
  USER_ALREADY_EXISTS: 'userAlreadyExists',
  USER_NOT_FOUND: 'userNotFound',
  ROLE_NOT_FOUND: 'roleNotFound',
  PERMISSION_DENIED: 'permissionDenied',
  RESOURCE_NOT_FOUND: 'resourceNotFound',
  OPERATION_NOT_ALLOWED: 'operationNotAllowed',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
