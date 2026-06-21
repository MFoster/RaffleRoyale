-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "display_name" TEXT;

-- RenameIndex
ALTER INDEX "pending_raffle_image_uploads_owner_id_consumed_at_expires_at_id" RENAME TO "pending_raffle_image_uploads_owner_id_consumed_at_expires_a_idx";
