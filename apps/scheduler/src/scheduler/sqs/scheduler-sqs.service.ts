import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { Injectable } from '@nestjs/common';
import { SchedulerConfigService } from '../config/scheduler-config.service';

@Injectable()
export class SchedulerSqsService {
  private readonly client: SQSClient;

  constructor(private readonly config: SchedulerConfigService) {
    this.client = new SQSClient({
      region: this.config.region,
      endpoint: this.config.sqsEndpointUrl,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    });
  }

  async sendMessage(queueUrl: string, payload: Record<string, unknown>): Promise<string> {
    const result = await this.client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(payload),
      }),
    );

    if (!result.MessageId) {
      throw new Error('SQS message did not include MessageId');
    }

    return result.MessageId;
  }
}
