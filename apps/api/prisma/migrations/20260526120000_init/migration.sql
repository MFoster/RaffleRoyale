-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."ItemType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "public"."RaffleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SOLD_OUT', 'EXPIRED', 'DISBANDED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."PayoutStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."RaffleEventType" AS ENUM ('CREATED', 'TICKET_PURCHASED', 'SOLD_OUT', 'EXPIRED', 'WINNER_SELECTED', 'DISBANDED', 'PAYOUT_SENT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "kyc_status" "public"."KycStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."raffles" (
    "id" TEXT NOT NULL,
    "raffler_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "item_type" "public"."ItemType" NOT NULL DEFAULT 'PHYSICAL',
    "total_tickets" INTEGER NOT NULL,
    "ticket_price" INTEGER NOT NULL,
    "tickets_sold" INTEGER NOT NULL DEFAULT 0,
    "min_sell_through" INTEGER,
    "status" "public"."RaffleStatus" NOT NULL DEFAULT 'DRAFT',
    "start_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raffles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tickets" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "ticket_number" INTEGER NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripe_payment_intent_id" TEXT,
    "status" "public"."TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payouts" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "raffler_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "stripe_transfer_id" TEXT,
    "status" "public"."PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."raffle_events" (
    "id" TEXT NOT NULL,
    "raffle_id" TEXT NOT NULL,
    "event_type" "public"."RaffleEventType" NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raffle_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "raffles_status_end_time_idx" ON "public"."raffles"("status", "end_time");

-- CreateIndex
CREATE INDEX "raffles_raffler_id_idx" ON "public"."raffles"("raffler_id");

-- CreateIndex
CREATE INDEX "tickets_buyer_id_idx" ON "public"."tickets"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_raffle_id_ticket_number_key" ON "public"."tickets"("raffle_id", "ticket_number");

-- AddForeignKey
ALTER TABLE "public"."raffles" ADD CONSTRAINT "raffles_raffler_id_fkey" FOREIGN KEY ("raffler_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tickets" ADD CONSTRAINT "tickets_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transactions" ADD CONSTRAINT "transactions_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payouts" ADD CONSTRAINT "payouts_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payouts" ADD CONSTRAINT "payouts_raffler_id_fkey" FOREIGN KEY ("raffler_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."raffle_events" ADD CONSTRAINT "raffle_events_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

