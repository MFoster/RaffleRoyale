import process from 'node:process';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type Message,
  type SQSClient,
} from '@aws-sdk/client-sqs';
import type { PrismaClient } from '@prisma/client';
import { commandMap } from '../commands';
import { createPrismaClient } from '../prisma/client';
import { createSqsClient } from './client';
import type { JobMessage, JobReply } from './types';

class InvalidJobMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidJobMessageError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown worker error.';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isInvalidJobMessageError(error: unknown): error is InvalidJobMessageError {
  return error instanceof InvalidJobMessageError;
}

function parseJobMessage(body: string): JobMessage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new InvalidJobMessageError('Job message body must be valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new InvalidJobMessageError('Job message body must be a JSON object.');
  }

  const { id, command, args, replyQueueUrl } = parsed;

  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new InvalidJobMessageError('Job message id must be a non-empty string.');
  }

  if (typeof command !== 'string' || command.trim().length === 0) {
    throw new InvalidJobMessageError('Job message command must be a non-empty string.');
  }

  if (
    args !== undefined &&
    (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string'))
  ) {
    throw new InvalidJobMessageError(
      'Job message args must be an array of strings when provided.',
    );
  }

  if (replyQueueUrl !== undefined && typeof replyQueueUrl !== 'string') {
    throw new InvalidJobMessageError(
      'Job message replyQueueUrl must be a string when provided.',
    );
  }

  return {
    id,
    command,
    ...(args ? { args } : {}),
    ...(replyQueueUrl ? { replyQueueUrl } : {}),
  };
}

function extractReplyContext(body: string | undefined): Partial<JobMessage> {
  if (!body) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(body);

    if (!isRecord(parsed)) {
      return {};
    }

    return {
      ...(typeof parsed.id === 'string' ? { id: parsed.id } : {}),
      ...(typeof parsed.command === 'string' ? { command: parsed.command } : {}),
      ...(typeof parsed.replyQueueUrl === 'string'
        ? { replyQueueUrl: parsed.replyQueueUrl }
        : {}),
    };
  } catch {
    return {};
  }
}

function buildReply(
  jobMessage: Pick<JobMessage, 'id' | 'command'>,
  result: { success: boolean; exitCode: number; error?: string },
): JobReply {
  return {
    id: jobMessage.id,
    command: jobMessage.command,
    success: result.success,
    exitCode: result.exitCode,
    ...(result.error ? { error: result.error } : {}),
    timestamp: new Date().toISOString(),
  };
}

function getReplyQueueUrl(jobMessage: Partial<JobMessage>): string | undefined {
  return jobMessage.replyQueueUrl ?? process.env.JOBS_SQS_REPLY_QUEUE_URL;
}

function createWorkerPrismaClient(): PrismaClient {
  if (process.env.DATABASE_URL) {
    return createPrismaClient();
  }

  console.warn(
    'DATABASE_URL is not set. Commands that use Prisma will fail until it is configured.',
  );

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === '$disconnect' || property === '$connect') {
          return () => Promise.resolve();
        }

        throw new Error(
          'DATABASE_URL is required for this command. Configure apps/jobs/.env or apps/api/.env before running DB commands.',
        );
      },
    },
  ) as PrismaClient;
}

async function sendReply(
  sqsClient: SQSClient,
  queueUrl: string,
  reply: JobReply,
): Promise<void> {
  console.log(
    `Sending ${reply.success ? 'success' : 'failure'} reply for job ${reply.id} to ${queueUrl}`,
  );

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(reply),
    }),
  );
}

async function sendFailureReplyIfConfigured(
  sqsClient: SQSClient,
  jobMessage: Partial<JobMessage>,
  error: string,
): Promise<void> {
  const replyQueueUrl = getReplyQueueUrl(jobMessage);

  if (!replyQueueUrl || !jobMessage.id || !jobMessage.command) {
    return;
  }

  try {
    await sendReply(
      sqsClient,
      replyQueueUrl,
      buildReply(jobMessage as Pick<JobMessage, 'id' | 'command'>, {
        success: false,
        exitCode: 1,
        error,
      }),
    );
  } catch (replyError) {
    console.error(
      `Failed to send failure reply for job ${jobMessage.id}: ${getErrorMessage(replyError)}`,
    );
  }
}

async function deleteMessageIfPossible(
  sqsClient: SQSClient,
  queueUrl: string,
  message: Message,
): Promise<void> {
  if (!message.ReceiptHandle) {
    console.error(
      `Cannot delete invalid SQS message ${message.MessageId ?? '<unknown>'}: missing receipt handle.`,
    );
    return;
  }

  await sqsClient.send(
    new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: message.ReceiptHandle,
    }),
  );
}

async function processMessage(
  sqsClient: SQSClient,
  queueUrl: string,
  message: Message,
  prisma: PrismaClient,
): Promise<void> {
  let jobMessage: JobMessage | undefined;
  const replyContext = extractReplyContext(message.Body);

  try {
    if (!message.Body) {
      throw new InvalidJobMessageError('Received SQS message without a body.');
    }

    jobMessage = parseJobMessage(message.Body);

    console.log(
      `Received SQS message ${message.MessageId ?? jobMessage.id} for command ${jobMessage.command}.`,
    );
    console.log(
      `Dispatching command ${jobMessage.command} with args: ${JSON.stringify(jobMessage.args ?? [])}`,
    );

    const command = commandMap.get(jobMessage.command);

    if (!command) {
      throw new InvalidJobMessageError(`Unknown command: ${jobMessage.command}`);
    }

    await command.run({ args: jobMessage.args ?? [], prisma });

    if (!message.ReceiptHandle) {
      throw new Error(
        `Received SQS message ${message.MessageId ?? jobMessage.id} without a receipt handle.`,
      );
    }

    await sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: message.ReceiptHandle,
      }),
    );

    console.log(`Command ${jobMessage.command} completed successfully for job ${jobMessage.id}.`);

    const replyQueueUrl = getReplyQueueUrl(jobMessage);

    if (!replyQueueUrl) {
      return;
    }

    try {
      await sendReply(
        sqsClient,
        replyQueueUrl,
        buildReply(jobMessage, { success: true, exitCode: 0 }),
      );
    } catch (replyError) {
      console.error(
        `Failed to send success reply for job ${jobMessage.id}: ${getErrorMessage(replyError)}`,
      );
    }
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    const failedJob = jobMessage ?? replyContext;

    console.error(
      `Command ${failedJob.command ?? '<unknown>'} failed${failedJob.id ? ` for job ${failedJob.id}` : ''}: ${errorMessage}`,
    );

    if (isInvalidJobMessageError(error)) {
      try {
        await deleteMessageIfPossible(sqsClient, queueUrl, message);
        console.log(
          `Deleted invalid SQS message ${message.MessageId ?? failedJob.id ?? '<unknown>'}.`,
        );
      } catch (deleteError) {
        console.error(
          `Failed to delete invalid SQS message ${message.MessageId ?? failedJob.id ?? '<unknown>'}: ${getErrorMessage(deleteError)}`,
        );
      }
    }

    await sendFailureReplyIfConfigured(sqsClient, failedJob, errorMessage);
  }
}

export async function startWorker(queueUrl: string): Promise<void> {
  const sqsClient = createSqsClient();
  const prisma = createWorkerPrismaClient();
  let shutdownRequested = false;
  let processingMessage = false;
  let receiveAbortController: AbortController | null = null;

  const handleSigterm = (): void => {
    if (shutdownRequested) {
      return;
    }

    shutdownRequested = true;
    console.log('Received SIGTERM. Worker will stop after the current message finishes.');

    if (!processingMessage) {
      receiveAbortController?.abort();
    }
  };

  process.on('SIGTERM', handleSigterm);

  try {
    while (!shutdownRequested) {
      try {
        receiveAbortController = new AbortController();

        const response = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            WaitTimeSeconds: 20,
          }),
          { abortSignal: receiveAbortController.signal },
        );

        const [message] = response.Messages ?? [];

        if (!message) {
          continue;
        }

        processingMessage = true;
        await processMessage(sqsClient, queueUrl, message, prisma);
      } catch (error) {
        if (shutdownRequested && isAbortError(error)) {
          break;
        }

        console.error(`SQS worker polling error: ${getErrorMessage(error)}`);
      } finally {
        receiveAbortController = null;
        processingMessage = false;
      }
    }
  } finally {
    process.off('SIGTERM', handleSigterm);
    await prisma.$disconnect();
    sqsClient.destroy();
    console.log('SQS worker stopped.');
  }
}
