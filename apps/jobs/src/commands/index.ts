import { cleanupPendingImagesCommand } from "./cleanup-pending-images.command";
import { dbHealthCommand } from "./db-health.command";
import { dbStatsCommand } from "./db-stats.command";
import { expireRaffleCommand } from "./expire-raffle.command";
import { fetchImagesCommand } from "./fetch-images.command";
import { fixSeedUrlsCommand } from "./fix-seed-urls.command";
import { migrateCommand } from "./migrate.command";
import { reconcileExpiredRafflesCommand } from "./reconcile-expired-raffles.command";
import { seedCommand } from "./seed.command";
import { sweepCommand } from "./sweep.command";
import type { JobCommand } from "./types";

export const commands: JobCommand[] = [
  migrateCommand,
  dbHealthCommand,
  dbStatsCommand,
  expireRaffleCommand,
  cleanupPendingImagesCommand,
  reconcileExpiredRafflesCommand,
  fetchImagesCommand,
  fixSeedUrlsCommand,
  seedCommand,
  sweepCommand,
];

export const commandMap = new Map(
  commands.map((command) => [command.name, command]),
);
