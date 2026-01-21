import { MarketplaceCode } from '../models/product.js';

export interface SchedulerConfig {
  cycleIntervalSeconds: number;
  batchSize: number;
  maxConcurrentScrapes: number;
}

export interface Task {
  id: string;
  type: 'product' | 'category';
  target: string; // ASIN or category URL
  marketplace: MarketplaceCode;
  priority: number;
  createdAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  error?: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export interface SchedulerStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  runningTasks: number;
  pendingTasks: number;
  averageTaskDuration: number;
  lastCycleTime: Date;
}
