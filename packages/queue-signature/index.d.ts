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
