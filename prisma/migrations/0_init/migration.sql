-- CreateEnum
CREATE TYPE "VisaEntryType" AS ENUM ('SINGLE', 'DOUBLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'UNPAID', 'SUBMITTED', 'IN_REVIEW', 'NEED_DOCS', 'APPROVED', 'REJECTED', 'READY_TO_DOWNLOAD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicantStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'NEED_DOCS', 'APPROVED', 'REJECTED', 'READY_TO_DOWNLOAD');

-- CreateEnum
CREATE TYPE "DocumentReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REUPLOAD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM', 'PORTAL_IDENTITY');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INITIALIZATION', 'AUTHORIZATION', 'CAPTURE', 'REFUND', 'VOID', 'CALLBACK', 'STATUS_UPDATE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CallbackProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "SignatureValidationStatus" AS ENUM ('VALID', 'INVALID', 'NOT_CHECKED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('PENDING', 'MATCHED', 'MISMATCHED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "EmailLogStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL DEFAULT 'ALLOW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_identities" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "portal_identity_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "iso_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "country_sections" (
    "id" TEXT NOT NULL,
    "country_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "country_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_types" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "validity_days" INTEGER NOT NULL,
    "max_stay" INTEGER NOT NULL,
    "entries" "VisaEntryType" NOT NULL DEFAULT 'SINGLE',
    "label" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "visa_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_sections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "template_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_fields" (
    "id" TEXT NOT NULL,
    "template_section_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT,
    "help_text" TEXT,
    "default_value" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "options_json" JSONB,
    "validation_rules_json" JSONB,
    "visibility_rules_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "template_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_bindings" (
    "id" TEXT NOT NULL,
    "destination_country_id" TEXT NOT NULL,
    "visa_type_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "template_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "binding_nationality_fees" (
    "id" TEXT NOT NULL,
    "template_binding_id" TEXT NOT NULL,
    "nationality_country_id" TEXT NOT NULL,
    "government_fee_amount" DECIMAL(10,2) NOT NULL,
    "service_fee_amount" DECIMAL(10,2) NOT NULL,
    "expedited_fee_amount" DECIMAL(10,2),
    "currency_code" TEXT NOT NULL,
    "expedited_enabled" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "binding_nationality_fees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_page_configs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sections_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_page_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "support_email" TEXT NOT NULL,
    "default_currency" TEXT NOT NULL DEFAULT 'USD',
    "payment_timeout_hours" INTEGER NOT NULL DEFAULT 3,
    "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "portal_identity_id" TEXT NOT NULL,
    "nationality_country_id" TEXT NOT NULL,
    "destination_country_id" TEXT NOT NULL,
    "visa_type_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_binding_id" TEXT NOT NULL,
    "total_fee_amount" DECIMAL(10,2) NOT NULL,
    "currency_code" TEXT NOT NULL,
    "expedited" BOOLEAN NOT NULL DEFAULT false,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_deadline_at" TIMESTAMP(3),
    "resume_token" TEXT NOT NULL,
    "current_status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_applicants" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "is_main_applicant" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "form_data_json" JSONB NOT NULL,
    "status" "ApplicantStatus" NOT NULL DEFAULT 'DRAFT',
    "application_code" TEXT,
    "result_file_name" TEXT,
    "result_storage_key" TEXT,
    "required_documents_json" JSONB,
    "additional_docs_requested_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "application_applicants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_history" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "old_status" "ApplicationStatus" NOT NULL,
    "new_status" "ApplicationStatus" NOT NULL,
    "note" TEXT,
    "changed_by_user_id" TEXT,
    "changed_by_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applicant_status_history" (
    "id" TEXT NOT NULL,
    "application_applicant_id" TEXT NOT NULL,
    "old_status" "ApplicantStatus" NOT NULL,
    "new_status" "ApplicantStatus" NOT NULL,
    "note" TEXT,
    "changed_by_user_id" TEXT,
    "changed_by_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applicant_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "application_applicant_id" TEXT NOT NULL,
    "document_type_key" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "storage_file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_key" TEXT,
    "storage_provider" TEXT NOT NULL DEFAULT 'local',
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "checksum" TEXT,
    "review_status" "DocumentReviewStatus" NOT NULL DEFAULT 'PENDING',
    "review_note" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "payment_provider_key" TEXT NOT NULL,
    "payment_method_key" TEXT,
    "currency_code" TEXT NOT NULL,
    "government_fee_amount" DECIMAL(10,2) NOT NULL,
    "service_fee_amount" DECIMAL(10,2) NOT NULL,
    "expedited_fee_amount" DECIMAL(10,2),
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payable_amount" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_payment_id" TEXT,
    "provider_session_id" TEXT,
    "provider_order_id" TEXT,
    "idempotency_key" TEXT,
    "expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "transaction_type" "TransactionType" NOT NULL,
    "transaction_status" "TransactionStatus" NOT NULL,
    "internal_transaction_reference" TEXT NOT NULL,
    "provider_transaction_reference" TEXT,
    "provider_event_key" TEXT,
    "request_payload_json" JSONB,
    "response_payload_json" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_status_history" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "old_status" "PaymentStatus" NOT NULL,
    "new_status" "PaymentStatus" NOT NULL,
    "change_reason" TEXT,
    "changed_by_user_id" TEXT,
    "changed_by_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_callbacks" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "payment_transaction_id" TEXT,
    "provider_key" TEXT NOT NULL,
    "callback_type" TEXT NOT NULL,
    "provider_event_id" TEXT,
    "headers_json" JSONB,
    "payload_json" JSONB NOT NULL,
    "signature_validation_status" "SignatureValidationStatus" NOT NULL DEFAULT 'NOT_CHECKED',
    "processing_status" "CallbackProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payment_callbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_reconciliations" (
    "id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "reconciliation_status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "provider_reported_amount" DECIMAL(10,2),
    "provider_reported_currency_code" TEXT,
    "provider_reported_status" TEXT,
    "checked_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "template_key" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "payload_json" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retry_count" INTEGER NOT NULL DEFAULT 3,
    "provider" TEXT,
    "message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retry_count" INTEGER NOT NULL DEFAULT 3,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_executions" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "execution_status" "JobExecutionStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "action_key" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value_json" JSONB,
    "new_value_json" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "template_key" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "provider" TEXT NOT NULL,
    "status" "EmailLogStatus" NOT NULL DEFAULT 'PENDING',
    "message_id" TEXT,
    "error_message" TEXT,
    "error_code" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "related_entity" TEXT,
    "related_entity_id" TEXT,
    "metadata_json" JSONB,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_id_idx" ON "users"("role_id");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_key_idx" ON "roles"("key");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_permission_key_key" ON "permissions"("permission_key");

-- CreateIndex
CREATE INDEX "permissions_module_key_idx" ON "permissions"("module_key");

-- CreateIndex
CREATE INDEX "permissions_permission_key_idx" ON "permissions"("permission_key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_module_key_action_key_key" ON "permissions"("module_key", "action_key");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE INDEX "user_permissions_user_id_idx" ON "user_permissions"("user_id");

-- CreateIndex
CREATE INDEX "user_permissions_permission_id_idx" ON "user_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_permissions_user_id_permission_id_key" ON "user_permissions"("user_id", "permission_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_refresh_token_hash_idx" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "portal_identities_email_key" ON "portal_identities"("email");

-- CreateIndex
CREATE INDEX "portal_identities_email_idx" ON "portal_identities"("email");

-- CreateIndex
CREATE INDEX "portal_identities_is_active_idx" ON "portal_identities"("is_active");

-- CreateIndex
CREATE INDEX "portal_sessions_portal_identity_id_idx" ON "portal_sessions"("portal_identity_id");

-- CreateIndex
CREATE INDEX "portal_sessions_refresh_token_hash_idx" ON "portal_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "portal_sessions_expires_at_idx" ON "portal_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "portal_sessions_revoked_at_idx" ON "portal_sessions"("revoked_at");

-- CreateIndex
CREATE INDEX "otp_codes_email_idx" ON "otp_codes"("email");

-- CreateIndex
CREATE INDEX "otp_codes_code_hash_idx" ON "otp_codes"("code_hash");

-- CreateIndex
CREATE INDEX "otp_codes_purpose_idx" ON "otp_codes"("purpose");

-- CreateIndex
CREATE INDEX "otp_codes_expires_at_idx" ON "otp_codes"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "countries_slug_key" ON "countries"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE INDEX "countries_slug_idx" ON "countries"("slug");

-- CreateIndex
CREATE INDEX "countries_iso_code_idx" ON "countries"("iso_code");

-- CreateIndex
CREATE INDEX "countries_is_active_idx" ON "countries"("is_active");

-- CreateIndex
CREATE INDEX "countries_is_published_idx" ON "countries"("is_published");

-- CreateIndex
CREATE INDEX "countries_deleted_at_idx" ON "countries"("deleted_at");

-- CreateIndex
CREATE INDEX "country_sections_country_id_idx" ON "country_sections"("country_id");

-- CreateIndex
CREATE INDEX "country_sections_sort_order_idx" ON "country_sections"("sort_order");

-- CreateIndex
CREATE INDEX "country_sections_is_active_idx" ON "country_sections"("is_active");

-- CreateIndex
CREATE INDEX "country_sections_deleted_at_idx" ON "country_sections"("deleted_at");

-- CreateIndex
CREATE INDEX "visa_types_purpose_idx" ON "visa_types"("purpose");

-- CreateIndex
CREATE INDEX "visa_types_is_active_idx" ON "visa_types"("is_active");

-- CreateIndex
CREATE INDEX "visa_types_sort_order_idx" ON "visa_types"("sort_order");

-- CreateIndex
CREATE INDEX "visa_types_deleted_at_idx" ON "visa_types"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "templates_key_key" ON "templates"("key");

-- CreateIndex
CREATE INDEX "templates_key_idx" ON "templates"("key");

-- CreateIndex
CREATE INDEX "templates_is_active_idx" ON "templates"("is_active");

-- CreateIndex
CREATE INDEX "templates_deleted_at_idx" ON "templates"("deleted_at");

-- CreateIndex
CREATE INDEX "template_sections_template_id_idx" ON "template_sections"("template_id");

-- CreateIndex
CREATE INDEX "template_sections_sort_order_idx" ON "template_sections"("sort_order");

-- CreateIndex
CREATE INDEX "template_sections_is_active_idx" ON "template_sections"("is_active");

-- CreateIndex
CREATE INDEX "template_sections_deleted_at_idx" ON "template_sections"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "template_sections_template_id_key_key" ON "template_sections"("template_id", "key");

-- CreateIndex
CREATE INDEX "template_fields_template_section_id_idx" ON "template_fields"("template_section_id");

-- CreateIndex
CREATE INDEX "template_fields_field_key_idx" ON "template_fields"("field_key");

-- CreateIndex
CREATE INDEX "template_fields_sort_order_idx" ON "template_fields"("sort_order");

-- CreateIndex
CREATE INDEX "template_fields_is_active_idx" ON "template_fields"("is_active");

-- CreateIndex
CREATE INDEX "template_fields_deleted_at_idx" ON "template_fields"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "template_fields_template_section_id_field_key_key" ON "template_fields"("template_section_id", "field_key");

-- CreateIndex
CREATE INDEX "template_bindings_destination_country_id_idx" ON "template_bindings"("destination_country_id");

-- CreateIndex
CREATE INDEX "template_bindings_visa_type_id_idx" ON "template_bindings"("visa_type_id");

-- CreateIndex
CREATE INDEX "template_bindings_template_id_idx" ON "template_bindings"("template_id");

-- CreateIndex
CREATE INDEX "template_bindings_is_active_idx" ON "template_bindings"("is_active");

-- CreateIndex
CREATE INDEX "template_bindings_deleted_at_idx" ON "template_bindings"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "template_bindings_destination_country_id_visa_type_id_key" ON "template_bindings"("destination_country_id", "visa_type_id");

-- CreateIndex
CREATE INDEX "binding_nationality_fees_template_binding_id_idx" ON "binding_nationality_fees"("template_binding_id");

-- CreateIndex
CREATE INDEX "binding_nationality_fees_nationality_country_id_idx" ON "binding_nationality_fees"("nationality_country_id");

-- CreateIndex
CREATE INDEX "binding_nationality_fees_is_active_idx" ON "binding_nationality_fees"("is_active");

-- CreateIndex
CREATE INDEX "binding_nationality_fees_deleted_at_idx" ON "binding_nationality_fees"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "binding_nationality_fees_template_binding_id_nationality_co_key" ON "binding_nationality_fees"("template_binding_id", "nationality_country_id");

-- CreateIndex
CREATE INDEX "payment_page_configs_is_active_idx" ON "payment_page_configs"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_template_key_key" ON "email_templates"("template_key");

-- CreateIndex
CREATE INDEX "email_templates_template_key_idx" ON "email_templates"("template_key");

-- CreateIndex
CREATE INDEX "email_templates_is_active_idx" ON "email_templates"("is_active");

-- CreateIndex
CREATE INDEX "email_templates_deleted_at_idx" ON "email_templates"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_resume_token_key" ON "applications"("resume_token");

-- CreateIndex
CREATE INDEX "applications_portal_identity_id_idx" ON "applications"("portal_identity_id");

-- CreateIndex
CREATE INDEX "applications_nationality_country_id_idx" ON "applications"("nationality_country_id");

-- CreateIndex
CREATE INDEX "applications_destination_country_id_idx" ON "applications"("destination_country_id");

-- CreateIndex
CREATE INDEX "applications_visa_type_id_idx" ON "applications"("visa_type_id");

-- CreateIndex
CREATE INDEX "applications_template_id_idx" ON "applications"("template_id");

-- CreateIndex
CREATE INDEX "applications_template_binding_id_idx" ON "applications"("template_binding_id");

-- CreateIndex
CREATE INDEX "applications_resume_token_idx" ON "applications"("resume_token");

-- CreateIndex
CREATE INDEX "applications_current_status_idx" ON "applications"("current_status");

-- CreateIndex
CREATE INDEX "applications_payment_status_idx" ON "applications"("payment_status");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE INDEX "applications_deleted_at_idx" ON "applications"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_applicants_application_code_key" ON "application_applicants"("application_code");

-- CreateIndex
CREATE INDEX "application_applicants_application_id_idx" ON "application_applicants"("application_id");

-- CreateIndex
CREATE INDEX "application_applicants_application_code_idx" ON "application_applicants"("application_code");

-- CreateIndex
CREATE INDEX "application_applicants_email_idx" ON "application_applicants"("email");

-- CreateIndex
CREATE INDEX "application_applicants_status_idx" ON "application_applicants"("status");

-- CreateIndex
CREATE INDEX "application_applicants_is_main_applicant_idx" ON "application_applicants"("is_main_applicant");

-- CreateIndex
CREATE INDEX "application_applicants_deleted_at_idx" ON "application_applicants"("deleted_at");

-- CreateIndex
CREATE INDEX "application_status_history_application_id_idx" ON "application_status_history"("application_id");

-- CreateIndex
CREATE INDEX "application_status_history_changed_by_user_id_idx" ON "application_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "application_status_history_created_at_idx" ON "application_status_history"("created_at");

-- CreateIndex
CREATE INDEX "applicant_status_history_application_applicant_id_idx" ON "applicant_status_history"("application_applicant_id");

-- CreateIndex
CREATE INDEX "applicant_status_history_changed_by_user_id_idx" ON "applicant_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "applicant_status_history_created_at_idx" ON "applicant_status_history"("created_at");

-- CreateIndex
CREATE INDEX "documents_application_applicant_id_idx" ON "documents"("application_applicant_id");

-- CreateIndex
CREATE INDEX "documents_document_type_key_idx" ON "documents"("document_type_key");

-- CreateIndex
CREATE INDEX "documents_review_status_idx" ON "documents"("review_status");

-- CreateIndex
CREATE INDEX "documents_reviewed_by_user_id_idx" ON "documents"("reviewed_by_user_id");

-- CreateIndex
CREATE INDEX "documents_storage_key_idx" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_reference_key" ON "payments"("payment_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_application_id_idx" ON "payments"("application_id");

-- CreateIndex
CREATE INDEX "payments_payment_reference_idx" ON "payments"("payment_reference");

-- CreateIndex
CREATE INDEX "payments_payment_provider_key_idx" ON "payments"("payment_provider_key");

-- CreateIndex
CREATE INDEX "payments_payment_status_idx" ON "payments"("payment_status");

-- CreateIndex
CREATE INDEX "payments_idempotency_key_idx" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");

-- CreateIndex
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_internal_transaction_reference_key" ON "payment_transactions"("internal_transaction_reference");

-- CreateIndex
CREATE INDEX "payment_transactions_payment_id_idx" ON "payment_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "payment_transactions_internal_transaction_reference_idx" ON "payment_transactions"("internal_transaction_reference");

-- CreateIndex
CREATE INDEX "payment_transactions_transaction_type_idx" ON "payment_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "payment_transactions_transaction_status_idx" ON "payment_transactions"("transaction_status");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at");

-- CreateIndex
CREATE INDEX "payment_status_history_payment_id_idx" ON "payment_status_history"("payment_id");

-- CreateIndex
CREATE INDEX "payment_status_history_changed_by_user_id_idx" ON "payment_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "payment_status_history_created_at_idx" ON "payment_status_history"("created_at");

-- CreateIndex
CREATE INDEX "payment_callbacks_payment_id_idx" ON "payment_callbacks"("payment_id");

-- CreateIndex
CREATE INDEX "payment_callbacks_payment_transaction_id_idx" ON "payment_callbacks"("payment_transaction_id");

-- CreateIndex
CREATE INDEX "payment_callbacks_provider_key_idx" ON "payment_callbacks"("provider_key");

-- CreateIndex
CREATE INDEX "payment_callbacks_processing_status_idx" ON "payment_callbacks"("processing_status");

-- CreateIndex
CREATE INDEX "payment_callbacks_received_at_idx" ON "payment_callbacks"("received_at");

-- CreateIndex
CREATE INDEX "payment_reconciliations_payment_id_idx" ON "payment_reconciliations"("payment_id");

-- CreateIndex
CREATE INDEX "payment_reconciliations_reconciliation_status_idx" ON "payment_reconciliations"("reconciliation_status");

-- CreateIndex
CREATE INDEX "payment_reconciliations_checked_at_idx" ON "payment_reconciliations"("checked_at");

-- CreateIndex
CREATE INDEX "notifications_channel_idx" ON "notifications"("channel");

-- CreateIndex
CREATE INDEX "notifications_template_key_idx" ON "notifications"("template_key");

-- CreateIndex
CREATE INDEX "notifications_recipient_idx" ON "notifications"("recipient");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "jobs_job_type_idx" ON "jobs"("job_type");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_scheduled_at_idx" ON "jobs"("scheduled_at");

-- CreateIndex
CREATE INDEX "jobs_created_at_idx" ON "jobs"("created_at");

-- CreateIndex
CREATE INDEX "job_executions_job_id_idx" ON "job_executions"("job_id");

-- CreateIndex
CREATE INDEX "job_executions_execution_status_idx" ON "job_executions"("execution_status");

-- CreateIndex
CREATE INDEX "job_executions_started_at_idx" ON "job_executions"("started_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_type_idx" ON "audit_logs"("actor_type");

-- CreateIndex
CREATE INDEX "audit_logs_action_key_idx" ON "audit_logs"("action_key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_idx" ON "audit_logs"("entity_type");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_idx" ON "audit_logs"("entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "email_logs_template_key_idx" ON "email_logs"("template_key");

-- CreateIndex
CREATE INDEX "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX "email_logs_provider_idx" ON "email_logs"("provider");

-- CreateIndex
CREATE INDEX "email_logs_status_idx" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "email_logs_related_entity_related_entity_id_idx" ON "email_logs"("related_entity", "related_entity_id");

-- CreateIndex
CREATE INDEX "email_logs_created_at_idx" ON "email_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "country_sections" ADD CONSTRAINT "country_sections_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_sections" ADD CONSTRAINT "template_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_fields" ADD CONSTRAINT "template_fields_template_section_id_fkey" FOREIGN KEY ("template_section_id") REFERENCES "template_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_bindings" ADD CONSTRAINT "template_bindings_destination_country_id_fkey" FOREIGN KEY ("destination_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_bindings" ADD CONSTRAINT "template_bindings_visa_type_id_fkey" FOREIGN KEY ("visa_type_id") REFERENCES "visa_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_bindings" ADD CONSTRAINT "template_bindings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binding_nationality_fees" ADD CONSTRAINT "binding_nationality_fees_template_binding_id_fkey" FOREIGN KEY ("template_binding_id") REFERENCES "template_bindings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "binding_nationality_fees" ADD CONSTRAINT "binding_nationality_fees_nationality_country_id_fkey" FOREIGN KEY ("nationality_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_portal_identity_id_fkey" FOREIGN KEY ("portal_identity_id") REFERENCES "portal_identities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_nationality_country_id_fkey" FOREIGN KEY ("nationality_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_destination_country_id_fkey" FOREIGN KEY ("destination_country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_visa_type_id_fkey" FOREIGN KEY ("visa_type_id") REFERENCES "visa_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_template_binding_id_fkey" FOREIGN KEY ("template_binding_id") REFERENCES "template_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_applicants" ADD CONSTRAINT "application_applicants_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_history" ADD CONSTRAINT "application_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_status_history" ADD CONSTRAINT "applicant_status_history_application_applicant_id_fkey" FOREIGN KEY ("application_applicant_id") REFERENCES "application_applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applicant_status_history" ADD CONSTRAINT "applicant_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_applicant_id_fkey" FOREIGN KEY ("application_applicant_id") REFERENCES "application_applicants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_status_history" ADD CONSTRAINT "payment_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_callbacks" ADD CONSTRAINT "payment_callbacks_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_reconciliations" ADD CONSTRAINT "payment_reconciliations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_executions" ADD CONSTRAINT "job_executions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

