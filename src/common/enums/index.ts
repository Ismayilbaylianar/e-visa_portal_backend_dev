// Re-export Prisma enums for use in application code
export {
  VisaEntryType,
  PermissionEffect,
  OtpPurpose,
  PaymentStatus,
  ApplicationStatus,
  ApplicantStatus,
  DocumentReviewStatus,
  NotificationChannel,
  NotificationStatus,
  JobStatus,
  JobExecutionStatus,
  ActorType,
  TransactionType,
  TransactionStatus,
  CallbackProcessingStatus,
  SignatureValidationStatus,
  ReconciliationStatus,
} from '@prisma/client';

// Additional application enums

export enum FieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  DATE = 'date',
  FILE = 'file',
  EMAIL = 'email',
  PHONE = 'phone',
  NUMBER = 'number',
}

export enum RouteGroup {
  PUBLIC = 'public',
  PORTAL = 'portal',
  ADMIN = 'admin',
  SYSTEM = 'system',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}
