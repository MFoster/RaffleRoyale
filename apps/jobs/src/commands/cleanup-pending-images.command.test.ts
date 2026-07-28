import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { cleanupPendingImagesCommand } from "./cleanup-pending-images.command";

void test("deletes the file before removing the locked pending upload record", async () => {
  const uploadsRoot = await mkdtemp(join(tmpdir(), "raffle-uploads-"));
  const raffleDirectory = join(uploadsRoot, "raffles");
  const fileName = "expired.png";
  const filePath = join(raffleDirectory, fileName);
  await mkdir(raffleDirectory, { recursive: true });
  await writeFile(filePath, "expired");

  const previousUploadsDirectory = process.env.UPLOADS_DIRECTORY;
  process.env.UPLOADS_DIRECTORY = uploadsRoot;
  let recordDeleted = false;

  const tx = {
    $queryRaw: () => Promise.resolve([{ id: "upload-1" }]),
    pendingRaffleImageUpload: {
      findUnique: () =>
        Promise.resolve({
          fileName,
          consumedAt: null,
          expiresAt: new Date("2020-08-01T00:00:00Z"),
        }),
      delete: () => {
        recordDeleted = true;
        return Promise.resolve();
      },
    },
  };
  const prisma = {
    pendingRaffleImageUpload: {
      findMany: () => Promise.resolve([{ id: "upload-1", fileName }]),
    },
    $transaction: (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  } as unknown as PrismaClient;

  try {
    await cleanupPendingImagesCommand.run({ args: [], prisma });
    await assert.rejects(
      async () => import("node:fs/promises").then((fs) => fs.stat(filePath)),
      { code: "ENOENT" },
    );
    assert.equal(recordDeleted, true);
  } finally {
    if (previousUploadsDirectory === undefined) {
      delete process.env.UPLOADS_DIRECTORY;
    } else {
      process.env.UPLOADS_DIRECTORY = previousUploadsDirectory;
    }
    await rm(uploadsRoot, { recursive: true, force: true });
  }
});

void test("keeps the database record when file deletion fails", async () => {
  const uploadsRoot = await mkdtemp(join(tmpdir(), "raffle-uploads-"));
  const raffleDirectory = join(uploadsRoot, "raffles");
  const fileName = "not-a-file";
  await mkdir(join(raffleDirectory, fileName), { recursive: true });

  const previousUploadsDirectory = process.env.UPLOADS_DIRECTORY;
  process.env.UPLOADS_DIRECTORY = uploadsRoot;
  let recordDeleted = false;

  const tx = {
    $queryRaw: () => Promise.resolve([{ id: "upload-1" }]),
    pendingRaffleImageUpload: {
      findUnique: () =>
        Promise.resolve({
          fileName,
          consumedAt: null,
          expiresAt: new Date("2020-08-01T00:00:00Z"),
        }),
      delete: () => {
        recordDeleted = true;
        return Promise.resolve();
      },
    },
  };
  const prisma = {
    pendingRaffleImageUpload: {
      findMany: () => Promise.resolve([{ id: "upload-1", fileName }]),
    },
    $transaction: (
      callback: (transaction: typeof tx) => Promise<unknown>,
    ) => callback(tx),
  } as unknown as PrismaClient;

  try {
    await assert.rejects(
      cleanupPendingImagesCommand.run({ args: [], prisma }),
    );
    assert.equal(recordDeleted, false);
  } finally {
    if (previousUploadsDirectory === undefined) {
      delete process.env.UPLOADS_DIRECTORY;
    } else {
      process.env.UPLOADS_DIRECTORY = previousUploadsDirectory;
    }
    await rm(uploadsRoot, { recursive: true, force: true });
  }
});
