import { SQSClient } from '@aws-sdk/client-sqs';

export function createSqsClient(): SQSClient {
  const region = process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = process.env.JOBS_SQS_ENDPOINT_URL;

  return new SQSClient({ region, ...(endpoint ? { endpoint } : {}) });
}
