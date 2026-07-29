import {
  CreateScheduleCommand,
  DeleteScheduleCommand,
  SchedulerClient,
} from '@aws-sdk/client-scheduler';
import { Injectable, Logger } from '@nestjs/common';
import {
  createRaffleExpirationJob,
  signQueuePayload,
} from '@raffleroyale/queue-signature';

@Injectable()
export class RaffleExpirationScheduler {
  private readonly logger = new Logger(RaffleExpirationScheduler.name);
  private readonly enabled =
    process.env.RAFFLE_EVENTBRIDGE_SCHEDULER_ENABLED === 'true';
  private readonly client = new SchedulerClient({
    region: process.env.AWS_REGION,
  });

  async createExpirationSchedule(
    raffleId: string,
    endTime: Date,
  ): Promise<boolean> {
    if (!this.enabled) {
      this.logger.debug(
        `EventBridge raffle scheduling is disabled; raffle ${raffleId} will rely on reconciliation.`,
      );
      return false;
    }

    const config = this.getConfig();
    const payload = signQueuePayload(
      createRaffleExpirationJob(raffleId),
      config.signingKey,
    );

    await this.client.send(
      new CreateScheduleCommand({
        Name: this.scheduleName(raffleId),
        GroupName: config.groupName,
        ScheduleExpression: `at(${this.toAtExpression(endTime)})`,
        FlexibleTimeWindow: { Mode: 'OFF' },
        ActionAfterCompletion: 'DELETE',
        Target: {
          Arn: config.queueArn,
          RoleArn: config.roleArn,
          Input: JSON.stringify(payload),
        },
      }),
    );

    return true;
  }

  async deleteExpirationSchedule(raffleId: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const { groupName } = this.getConfig();
    await this.client.send(
      new DeleteScheduleCommand({
        Name: this.scheduleName(raffleId),
        GroupName: groupName,
      }),
    );
  }

  private scheduleName(raffleId: string): string {
    return `raffle-expiration-${raffleId}`;
  }

  private toAtExpression(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, '');
  }

  private getConfig(): {
    groupName: string;
    roleArn: string;
    queueArn: string;
    signingKey: string;
  } {
    const groupName = process.env.EVENTBRIDGE_SCHEDULER_GROUP_NAME;
    const roleArn = process.env.EVENTBRIDGE_SCHEDULER_ROLE_ARN;
    const queueArn = process.env.JOBS_SQS_QUEUE_ARN;
    const signingKey = process.env.QUEUE_MESSAGE_SIGNING_KEY;

    if (!groupName || !roleArn || !queueArn || !signingKey) {
      throw new Error(
        'EventBridge raffle scheduling requires EVENTBRIDGE_SCHEDULER_GROUP_NAME, EVENTBRIDGE_SCHEDULER_ROLE_ARN, JOBS_SQS_QUEUE_ARN, and QUEUE_MESSAGE_SIGNING_KEY.',
      );
    }

    return { groupName, roleArn, queueArn, signingKey };
  }
}
