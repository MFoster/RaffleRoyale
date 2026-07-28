import type { QueueJobMessage } from "@raffleroyale/queue-signature";

export type JobMessage = QueueJobMessage;

export type JobReply = {
  id: string;
  command: string;
  success: boolean;
  exitCode: number;
  error?: string;
  timestamp: string;
};
