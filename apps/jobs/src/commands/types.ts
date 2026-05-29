import type { PrismaClient } from '@prisma/client';

export type CommandContext = {
  args: string[];
  prisma: PrismaClient;
};

export type JobCommand = {
  name: string;
  description: string;
  run: (context: CommandContext) => Promise<void>;
};
