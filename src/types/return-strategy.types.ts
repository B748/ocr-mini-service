export type ReturnStrategy = 'sse' | 'webhook' | 'polling';

export interface ProcessingRequest {
  returnStrategy: ReturnStrategy;
  webhookUrl?: string;
  callbackHeaders?: Record<string, string>;
}

export interface JobStatus {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface WebhookPayload {
  jobId: string;
  status: 'completed' | 'failed';
  result?: any;
  error?: string;
  timestamp: Date;
}