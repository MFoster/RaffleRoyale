export type ScheduleState = 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Schedule {
  id: string;
  name: string;
  runAt: string;
  payload: Record<string, unknown>;
  targetQueueUrl: string;
  state: ScheduleState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateScheduleRequestEventBridge {
  Name: string;
  ScheduleExpression: string;
  Target: {
    Input: string;
  };
}

export interface CreateScheduleRequestLocal {
  name: string;
  runAt: string;
  payload: Record<string, unknown>;
}

export type CreateScheduleRequest = CreateScheduleRequestEventBridge | CreateScheduleRequestLocal;

export interface ParsedScheduleRequest {
  name: string;
  runAt: string;
  payload: Record<string, unknown>;
}
