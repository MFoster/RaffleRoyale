-- CreateTable
CREATE TABLE "public"."pending_raffle_image_uploads" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "raffle_id" TEXT,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "url_path" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_raffle_image_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_raffle_image_uploads_file_name_key" ON "public"."pending_raffle_image_uploads"("file_name");

-- CreateIndex
CREATE INDEX "pending_raffle_image_uploads_owner_id_consumed_at_expires_at_idx" ON "public"."pending_raffle_image_uploads"("owner_id", "consumed_at", "expires_at");

-- CreateIndex
CREATE INDEX "pending_raffle_image_uploads_expires_at_consumed_at_idx" ON "public"."pending_raffle_image_uploads"("expires_at", "consumed_at");

-- AddForeignKey
ALTER TABLE "public"."pending_raffle_image_uploads" ADD CONSTRAINT "pending_raffle_image_uploads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pending_raffle_image_uploads" ADD CONSTRAINT "pending_raffle_image_uploads_raffle_id_fkey" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
