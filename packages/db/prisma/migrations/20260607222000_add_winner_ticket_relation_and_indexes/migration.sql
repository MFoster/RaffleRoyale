-- AlterTable
ALTER TABLE "public"."raffle_events"
ADD COLUMN "winner_ticket_id" TEXT;

-- CreateIndex
CREATE INDEX "tickets_raffle_id_idx" ON "public"."tickets"("raffle_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "public"."transactions"("user_id");

-- CreateIndex
CREATE INDEX "raffle_events_raffle_id_idx" ON "public"."raffle_events"("raffle_id");

-- CreateIndex
CREATE INDEX "raffle_events_winner_ticket_id_idx" ON "public"."raffle_events"("winner_ticket_id");

-- AddForeignKey
ALTER TABLE "public"."raffle_events"
ADD CONSTRAINT "raffle_events_winner_ticket_id_fkey"
FOREIGN KEY ("winner_ticket_id") REFERENCES "public"."tickets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
