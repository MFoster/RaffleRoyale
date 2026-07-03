-- AlterEnum
ALTER TYPE "RaffleEventType" ADD VALUE 'DRAW_COMMITTED';

-- AlterEnum
ALTER TYPE "RaffleStatus" ADD VALUE 'PENDING_DRAW';

-- AlterTable
ALTER TABLE "raffles" ADD COLUMN     "draw_available_at" TIMESTAMP(3),
ADD COLUMN     "draw_beacon_chain_hash" TEXT,
ADD COLUMN     "draw_beacon_round" BIGINT,
ADD COLUMN     "draw_committed_at" TIMESTAMP(3),
ADD COLUMN     "draw_scheme" TEXT;

-- CreateIndex
CREATE INDEX "raffles_status_draw_available_at_idx" ON "raffles"("status", "draw_available_at");
