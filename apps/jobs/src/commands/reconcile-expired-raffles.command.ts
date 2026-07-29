import { RaffleStatus } from "@prisma/client";
import { JOB_COMMANDS } from "@raffleroyale/queue-signature";
import { expireRaffle } from "../raffle/expire-raffle";
import { sweepCommand } from "./sweep.command";
import type { JobCommand } from "./types";

export const reconcileExpiredRafflesCommand: JobCommand = {
  name: JOB_COMMANDS.RECONCILE_EXPIRED_RAFFLES,
  description:
    "Repair missed raffle expirations, then advance eligible winner draws.",
  async run({ args, prisma }) {
    if (args.length > 0) {
      throw new Error("reconcile-expired-raffles does not accept arguments.");
    }

    const now = new Date();
    const candidates = await prisma.raffle.findMany({
      where: {
        status: RaffleStatus.ACTIVE,
        endTime: { lte: now },
      },
      select: { id: true },
      orderBy: { endTime: "asc" },
    });

    const results: Record<string, number> = {};
    const errors: Error[] = [];
    for (const candidate of candidates) {
      try {
        const result = await expireRaffle(prisma, candidate.id, now);
        results[result] = (results[result] ?? 0) + 1;
      } catch (error) {
        const candidateError =
          error instanceof Error ? error : new Error(String(error));
        errors.push(candidateError);
        console.error(
          `Failed reconciling raffle ${candidate.id}: ${candidateError.message}`,
        );
      }
    }

    console.log(
      `Reconciled ${String(candidates.length)} expired raffle candidates: ${JSON.stringify(results)}.`,
    );
    await sweepCommand.run({ args: [], prisma });

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `Failed reconciling ${String(errors.length)} expired raffles.`,
      );
    }
  },
};
