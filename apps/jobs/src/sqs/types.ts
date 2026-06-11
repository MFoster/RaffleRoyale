export type JobMessage = {
  id: string;
  command: string;
  args?: string[];
  replyQueueUrl?: string;
};

export type JobReply = {
  id: string;
  command: string;
  success: boolean;
  exitCode: number;
  error?: string;
  timestamp: string;
};
