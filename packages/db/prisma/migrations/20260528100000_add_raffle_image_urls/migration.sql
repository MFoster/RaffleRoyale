-- AlterTable
ALTER TABLE "public"."raffles"
ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
