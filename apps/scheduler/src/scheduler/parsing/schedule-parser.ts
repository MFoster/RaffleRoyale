import { BadRequestException } from '@nestjs/common';
import type {
  CreateScheduleRequestEventBridge,
  CreateScheduleRequestLocal,
  ParsedScheduleRequest,
} from '../types/schedule.types';

export function isEventBridgeFormat(body: unknown): body is CreateScheduleRequestEventBridge {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const value = body as Record<string, unknown>;
  const target = value.Target as Record<string, unknown> | undefined;

  return (
    typeof value.Name === 'string' &&
    typeof value.ScheduleExpression === 'string' &&
    typeof target === 'object' &&
    target !== null &&
    typeof target.Input === 'string'
  );
}

export function isLocalFormat(body: unknown): body is CreateScheduleRequestLocal {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const value = body as Record<string, unknown>;
  return (
    typeof value.name === 'string' &&
    typeof value.runAt === 'string' &&
    typeof value.payload === 'object' &&
    value.payload !== null
  );
}

export function parseScheduleExpression(expression: string): string {
  const match = expression.match(/^at\((.+)\)$/);
  if (!match) {
    throw new BadRequestException(
      `Invalid ScheduleExpression format: ${expression}. Expected format: at(ISO_TIMESTAMP)`,
    );
  }

  const runAt = new Date(match[1]);
  if (Number.isNaN(runAt.getTime())) {
    throw new BadRequestException(`Invalid timestamp in ScheduleExpression: ${match[1]}`);
  }

  return runAt.toISOString();
}

function parseEventBridgeRequest(body: CreateScheduleRequestEventBridge): ParsedScheduleRequest {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body.Target.Input) as Record<string, unknown>;
  } catch {
    throw new BadRequestException(`Failed to parse Target.Input as JSON: ${body.Target.Input}`);
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new BadRequestException('Target.Input must be a JSON object');
  }

  return {
    name: body.Name,
    runAt: parseScheduleExpression(body.ScheduleExpression),
    payload,
  };
}

function parseLocalRequest(body: CreateScheduleRequestLocal): ParsedScheduleRequest {
  const runAt = new Date(body.runAt);
  if (Number.isNaN(runAt.getTime())) {
    throw new BadRequestException(`Invalid runAt timestamp: ${body.runAt}`);
  }

  return {
    name: body.name,
    runAt: runAt.toISOString(),
    payload: body.payload,
  };
}

export function autoDetectAndParseRequest(body: unknown): ParsedScheduleRequest {
  if (isEventBridgeFormat(body)) {
    return parseEventBridgeRequest(body);
  }

  if (isLocalFormat(body)) {
    return parseLocalRequest(body);
  }

  throw new BadRequestException(
    'Request body does not match EventBridge or local format. Expected either {Name, ScheduleExpression, Target} or {name, runAt, payload}',
  );
}
