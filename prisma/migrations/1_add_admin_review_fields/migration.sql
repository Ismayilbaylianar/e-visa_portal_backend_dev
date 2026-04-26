-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "admin_note" TEXT,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "requested_document_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewed_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "applications_reviewed_by_user_id_idx" ON "applications"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

