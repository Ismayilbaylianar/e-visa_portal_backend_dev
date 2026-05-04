/**
 * Application error codes
 * Used for consistent error identification across the API
 */
export const ErrorCodes = {
  // ==========================================
  // Common errors (4xx/5xx)
  // ==========================================
  BAD_REQUEST: 'badRequest',
  VALIDATION_ERROR: 'validationError',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'notFound',
  CONFLICT: 'conflict',
  UNPROCESSABLE_ENTITY: 'unprocessableEntity',
  TOO_MANY_REQUESTS: 'tooManyRequests',
  INTERNAL_SERVER_ERROR: 'internalServerError',
  SERVICE_UNAVAILABLE: 'serviceUnavailable',
  DATABASE_ERROR: 'databaseError',

  // ==========================================
  // Authentication errors
  // ==========================================
  INVALID_CREDENTIALS: 'invalidCredentials',
  INVALID_TOKEN: 'invalidToken',
  TOKEN_EXPIRED: 'tokenExpired',
  SESSION_EXPIRED: 'sessionExpired',
  OTP_INVALID: 'otpInvalid',
  OTP_EXPIRED: 'otpExpired',
  OTP_ALREADY_USED: 'otpAlreadyUsed',
  ACCOUNT_INACTIVE: 'accountInactive',
  PERMISSION_DENIED: 'permissionDenied',

  // ==========================================
  // Business logic errors
  // ==========================================
  BINDING_NOT_FOUND: 'bindingNotFound',
  SAME_COUNTRY_BLOCKED: 'sameCountryBlocked',
  TEMPLATE_NOT_FOUND: 'templateNotFound',
  APPLICATION_NOT_FOUND: 'applicationNotFound',
  APPLICATION_ALREADY_SUBMITTED: 'applicationAlreadySubmitted',
  APPLICATION_NOT_EDITABLE: 'applicationNotEditable',
  INVALID_STATUS_TRANSITION: 'invalidStatusTransition',
  DOCUMENT_NOT_FOUND: 'documentNotFound',
  USER_NOT_FOUND: 'userNotFound',
  ROLE_NOT_FOUND: 'roleNotFound',
  COUNTRY_NOT_FOUND: 'countryNotFound',
  VISA_TYPE_NOT_FOUND: 'visaTypeNotFound',
  APPLICANT_NOT_FOUND: 'applicantNotFound',
  // M9b — customer document resubmission
  NOT_NEED_DOCS_STATE: 'notNeedDocsState',
  DOCUMENT_TYPE_NOT_REQUESTED: 'documentTypeNotRequested',
  RESUBMIT_FILE_LIMIT_EXCEEDED: 'resubmitFileLimitExceeded',

  // ==========================================
  // Upload/Storage errors
  // ==========================================
  FILE_TOO_LARGE: 'fileTooLarge',
  FILE_TYPE_NOT_ALLOWED: 'fileTypeNotAllowed',
  FILE_UPLOAD_FAILED: 'fileUploadFailed',
  FILE_NOT_FOUND: 'fileNotFound',
  FILE_DOWNLOAD_FAILED: 'fileDownloadFailed',
  FILE_DELETE_FAILED: 'fileDeleteFailed',
  FILE_EXTENSION_NOT_ALLOWED: 'fileExtensionNotAllowed',
  FILE_CHECKSUM_MISMATCH: 'fileChecksumMismatch',
  STORAGE_PROVIDER_ERROR: 'storageProviderError',

  // ==========================================
  // Payment errors
  // ==========================================
  PAYMENT_NOT_FOUND: 'paymentNotFound',
  PAYMENT_INITIALIZATION_FAILED: 'paymentInitializationFailed',
  PAYMENT_PROVIDER_UNAVAILABLE: 'paymentProviderUnavailable',
  PAYMENT_CALLBACK_INVALID: 'paymentCallbackInvalid',
  PAYMENT_ALREADY_PROCESSED: 'paymentAlreadyProcessed',
  PAYMENT_AMOUNT_MISMATCH: 'paymentAmountMismatch',
  PAYMENT_EXPIRED: 'paymentExpired',

  // ==========================================
  // Email errors
  // ==========================================
  EMAIL_SEND_FAILED: 'emailSendFailed',
  EMAIL_PROVIDER_NOT_CONFIGURED: 'emailProviderNotConfigured',
  EMAIL_TEMPLATE_NOT_FOUND: 'emailTemplateNotFound',
  EMAIL_TEMPLATE_INVALID: 'emailTemplateInvalid',
  EMAIL_MISSING_VARIABLES: 'emailMissingVariables',

  // ==========================================
  // OTP throttling errors
  // ==========================================
  OTP_RESEND_COOLDOWN: 'otpResendCooldown',
  OTP_MAX_ATTEMPTS_EXCEEDED: 'otpMaxAttemptsExceeded',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * HTTP status code mapping for error codes
 */
export const ErrorCodeHttpStatus: Record<ErrorCode, number> = {
  // Common
  [ErrorCodes.BAD_REQUEST]: 400,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.NOT_FOUND]: 404,
  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCodes.TOO_MANY_REQUESTS]: 429,
  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.DATABASE_ERROR]: 500,

  // Auth
  [ErrorCodes.INVALID_CREDENTIALS]: 401,
  [ErrorCodes.INVALID_TOKEN]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.SESSION_EXPIRED]: 401,
  [ErrorCodes.OTP_INVALID]: 400,
  [ErrorCodes.OTP_EXPIRED]: 400,
  [ErrorCodes.OTP_ALREADY_USED]: 400,
  [ErrorCodes.ACCOUNT_INACTIVE]: 403,
  [ErrorCodes.PERMISSION_DENIED]: 403,

  // Business
  [ErrorCodes.BINDING_NOT_FOUND]: 404,
  [ErrorCodes.SAME_COUNTRY_BLOCKED]: 400,
  [ErrorCodes.TEMPLATE_NOT_FOUND]: 404,
  [ErrorCodes.APPLICATION_NOT_FOUND]: 404,
  [ErrorCodes.APPLICATION_ALREADY_SUBMITTED]: 409,
  [ErrorCodes.APPLICATION_NOT_EDITABLE]: 409,
  [ErrorCodes.INVALID_STATUS_TRANSITION]: 400,
  [ErrorCodes.DOCUMENT_NOT_FOUND]: 404,
  [ErrorCodes.USER_NOT_FOUND]: 404,
  [ErrorCodes.ROLE_NOT_FOUND]: 404,
  [ErrorCodes.COUNTRY_NOT_FOUND]: 404,
  [ErrorCodes.VISA_TYPE_NOT_FOUND]: 404,
  [ErrorCodes.APPLICANT_NOT_FOUND]: 404,
  // M9b
  [ErrorCodes.NOT_NEED_DOCS_STATE]: 409,
  [ErrorCodes.DOCUMENT_TYPE_NOT_REQUESTED]: 400,
  [ErrorCodes.RESUBMIT_FILE_LIMIT_EXCEEDED]: 400,

  // Upload/Storage
  [ErrorCodes.FILE_TOO_LARGE]: 413,
  [ErrorCodes.FILE_TYPE_NOT_ALLOWED]: 415,
  [ErrorCodes.FILE_UPLOAD_FAILED]: 500,
  [ErrorCodes.FILE_NOT_FOUND]: 404,
  [ErrorCodes.FILE_DOWNLOAD_FAILED]: 500,
  [ErrorCodes.FILE_DELETE_FAILED]: 500,
  [ErrorCodes.FILE_EXTENSION_NOT_ALLOWED]: 415,
  [ErrorCodes.FILE_CHECKSUM_MISMATCH]: 422,
  [ErrorCodes.STORAGE_PROVIDER_ERROR]: 500,

  // Payment
  [ErrorCodes.PAYMENT_NOT_FOUND]: 404,
  [ErrorCodes.PAYMENT_INITIALIZATION_FAILED]: 500,
  [ErrorCodes.PAYMENT_PROVIDER_UNAVAILABLE]: 503,
  [ErrorCodes.PAYMENT_CALLBACK_INVALID]: 400,
  [ErrorCodes.PAYMENT_ALREADY_PROCESSED]: 409,
  [ErrorCodes.PAYMENT_AMOUNT_MISMATCH]: 400,
  [ErrorCodes.PAYMENT_EXPIRED]: 410,

  // Email
  [ErrorCodes.EMAIL_SEND_FAILED]: 500,
  [ErrorCodes.EMAIL_PROVIDER_NOT_CONFIGURED]: 503,
  [ErrorCodes.EMAIL_TEMPLATE_NOT_FOUND]: 404,
  [ErrorCodes.EMAIL_TEMPLATE_INVALID]: 400,
  [ErrorCodes.EMAIL_MISSING_VARIABLES]: 400,

  // OTP throttling
  [ErrorCodes.OTP_RESEND_COOLDOWN]: 429,
  [ErrorCodes.OTP_MAX_ATTEMPTS_EXCEEDED]: 429,
};
