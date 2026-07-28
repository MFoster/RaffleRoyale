export const JOB_COMMANDS: Readonly<{
  EXPIRE_RAFFLE: 'expire-raffle';
  CLEANUP_PENDING_IMAGES: 'cleanup-pending-images';
  RECONCILE_EXPIRED_RAFFLES: 'reconcile-expired-raffles';
}>;

export type QueueJobMessage = {
  id: string;
  command: string;
  args?: string[];
  replyQueueUrl?: string;
};

export function createQueueJobMessage(
  input: QueueJobMessage,
): QueueJobMessage;

export function createRaffleExpirationJob(
  raffleId: string,
): QueueJobMessage;

export function signQueuePayload(
  payload: Record<string, unknown>,
  signingKey: string,
): Record<string, unknown>;

export function verifyQueuePayload(
  payload: Record<string, unknown>,
  signingKey: string,
): Record<string, unknown>;

export function parseAndVerifyQueueMessage(
  messageBody: string,
  signingKey: string,
): Record<string, unknown>;
