import { Prisma } from "@prisma/client";
import { JOB_COMMANDS } from "@raffleroyale/queue-signature";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import type { JobCommand } from "./types";

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

export const cleanupPendingImagesCommand: JobCommand = {
  name: JOB_COMMANDS.CLEANUP_PENDING_IMAGES,
  description: "Delete expired, unclaimed raffle image uploads.",
  async run({ args, prisma }) {
    if (args.length > 0) {
      throw new Error("cleanup-pending-images does not accept arguments.");
    }

    const uploadsRoot =
      process.env.UPLOADS_DIRECTORY ?? join(process.cwd(), "uploads");
    const raffleUploadsDirectory = join(uploadsRoot, "raffles");
    const now = new Date();
    const uploads = await prisma.pendingRaffleImageUpload.findMany({
      where: {
        consumedAt: null,
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        fileName: true,
      },
    });

    let deletedRecords = 0;
    let deletedFiles = 0;

    for (const upload of uploads) {
      const result = await prisma.$transaction(
        async (tx) => {
          const lockRows = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM pending_raffle_image_uploads WHERE id = ${upload.id} FOR UPDATE`,
          );
          if (lockRows.length === 0) {
            return { deletedRecord: false, deletedFile: false };
          }

          const current = await tx.pendingRaffleImageUpload.findUnique({
            where: { id: upload.id },
            select: {
              fileName: true,
              consumedAt: true,
              expiresAt: true,
            },
          });
          if (
            !current ||
            current.consumedAt !== null ||
            current.expiresAt.getTime() > now.getTime()
          ) {
            return { deletedRecord: false, deletedFile: false };
          }

          let deletedFile = false;
          try {
            await unlink(join(raffleUploadsDirectory, current.fileName));
            deletedFile = true;
          } catch (error) {
            if (!isErrnoException(error) || error.code !== "ENOENT") {
              throw error;
            }
          }

          await tx.pendingRaffleImageUpload.delete({
            where: { id: upload.id },
          });
          return { deletedRecord: true, deletedFile };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (result.deletedRecord) {
        deletedRecords += 1;
        if (result.deletedFile) {
          deletedFiles += 1;
        }
      }
    }

    console.log(
      `Deleted ${String(deletedRecords)} expired pending image records and ${String(deletedFiles)} files.`,
    );
  },
};
