import { JOB_COMMANDS } from "@raffleroyale/queue-signature";
import { expireRaffle } from "../raffle/expire-raffle";
import type { JobCommand } from "./types";

export const expireRaffleCommand: JobCommand = {
  name: JOB_COMMANDS.EXPIRE_RAFFLE,
  description: "Expire or disband one raffle after its configured end time.",
  async run({ args, prisma }) {
    const [raffleId, ...extraArgs] = args;
    if (!raffleId || extraArgs.length > 0) {
      throw new Error("expire-raffle requires exactly one raffle ID.");
    }

    const result = await expireRaffle(prisma, raffleId);
    console.log(`Raffle ${raffleId} expiration result: ${result}.`);
  },
};
