import cron from 'node-cron';
import Decimal from 'decimal.js';
import { SchedulerConfig, SchedulerStats, Task } from './types.js';
import { TaskQueue } from './task-queue.js';
import { AmazonScraper } from '../scraper/scraper.js';
import { DealAnalyzer } from '../analyzer/analyzer.js';
import { DiscordBot } from '../discord/bot.js';
import { logger } from '../utils/logger.js';
import { MarketplaceCode } from '../models/product.js';

export class DealScheduler {
  private taskQueue: TaskQueue;
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private stats: SchedulerStats;

  constructor(
    private config: SchedulerConfig,
    private scraper: AmazonScraper,
    private analyzer: DealAnalyzer,
    private discordBot: DiscordBot
  ) {
    this.taskQueue = new TaskQueue();
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      pendingTasks: 0,
      averageTaskDuration: 0,
      lastCycleTime: new Date(),
    };
  }

  start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    logger.info('Starting deal scheduler...');

    // Schedule the task cycle
    const cronExpression = this.getCronExpression();
    this.cronJob = cron.schedule(cronExpression, () => {
      this.runCycle();
    });

    this.isRunning = true;
    logger.info(`Deal scheduler started (interval: ${this.config.cycleIntervalSeconds}s)`);
  }

  stop(): void {
    if (!this.isRunning) {
      logger.warn('Scheduler is not running');
      return;
    }

    logger.info('Stopping deal scheduler...');

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.isRunning = false;
    logger.info('Deal scheduler stopped');
  }

  private getCronExpression(): string {
    // Convert seconds to cron expression
    // For example, 60 seconds = */1 * * * *
    const minutes = Math.floor(this.config.cycleIntervalSeconds / 60);
    const seconds = this.config.cycleIntervalSeconds % 60;

    if (minutes > 0 && seconds === 0) {
      return `*/${minutes} * * * *`;
    } else if (minutes === 0 && seconds > 0) {
      // node-cron doesn't support seconds, so we'll use a different approach
      return '* * * * *'; // Every minute, we'll handle the interval in the cycle
    } else {
      return '* * * * *';
    }
  }

  private async runCycle(): Promise<void> {
    if (this.taskQueue.getQueueLength() === 0) {
      logger.debug('No tasks in queue, skipping cycle');
      return;
    }

    logger.info(`Starting cycle with ${this.taskQueue.getQueueLength()} pending tasks`);

    const startTime = Date.now();

    try {
      // Get batch of tasks
      const tasks = this.taskQueue.getNextTasks(Math.min(this.config.batchSize, this.config.maxConcurrentScrapes));

      if (tasks.length === 0) {
        return;
      }

      // Process tasks concurrently
      const promises = tasks.map((task) => this.processTask(task));
      await Promise.all(promises);

      const duration = Date.now() - startTime;
      this.stats.lastCycleTime = new Date();
      this.updateStats();

      logger.info(`Cycle completed in ${duration}ms (${tasks.length} tasks processed)`);
    } catch (error) {
      logger.error(`Error in cycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processTask(task: Task): Promise<void> {
    const startTime = Date.now();

    try {
      let data: any;

      if (task.type === 'product') {
        // Scrape product
        const result = await this.scraper.scrapeProduct(task.target, task.marketplace);

        if (result.success && result.data) {
          // Analyze deal
          const deal = this.analyzer.analyze(result.data, {
            costPrice: new Decimal(new Date().getTime() % 100), // Placeholder - should come from API
            fulfillmentType: 'FBA',
            category: 'default',
          });

          // Send notification if deal qualifies
          if (deal.tier !== 'low' || deal.metrics.margin >= 25) {
            await this.discordBot.sendDealNotification(deal);
          }

          data = { deal };
        } else {
          throw new Error(result.error || 'Failed to scrape product');
        }
      } else if (task.type === 'category') {
        // Scrape category
        const result = await this.scraper.scrapeCategory(task.target, task.marketplace, 50);

        if (result.success && result.data) {
          // Add ASINs to queue as product tasks
          const newTasks = result.data.asins.map((asin) => ({
            type: 'product' as const,
            target: asin,
            marketplace: task.marketplace,
            priority: task.priority,
            maxRetries: 3,
          }));

          this.taskQueue.addTasks(newTasks);
          data = { asins: result.data.asins };
        } else {
          throw new Error(result.error || 'Failed to scrape category');
        }
      }

      this.taskQueue.completeTask(task.id, {
        success: true,
        data,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.taskQueue.failTask(task.id, errorMessage);
    }
  }

  addProductTask(asin: string, marketplace: MarketplaceCode, priority: number = 1): string {
    const taskId = this.taskQueue.addTask({
      type: 'product',
      target: asin,
      marketplace,
      priority,
      maxRetries: 3,
    });

    this.stats.totalTasks++;
    logger.debug(`Product task added: ${asin} (${marketplace})`);
    return taskId;
  }

  addCategoryTask(url: string, marketplace: MarketplaceCode, priority: number = 1): string {
    const taskId = this.taskQueue.addTask({
      type: 'category',
      target: url,
      marketplace,
      priority,
      maxRetries: 3,
    });

    this.stats.totalTasks++;
    logger.debug(`Category task added: ${url} (${marketplace})`);
    return taskId;
  }

  private updateStats(): void {
    const queueStats = this.taskQueue.getStats();
    this.stats.pendingTasks = queueStats.queueLength;
    this.stats.runningTasks = queueStats.runningTasks;
    this.stats.completedTasks = queueStats.completedTasks;
    this.stats.averageTaskDuration = queueStats.averageDuration;
    this.stats.failedTasks = this.stats.totalTasks - this.stats.completedTasks - this.stats.runningTasks;
  }

  getStats(): SchedulerStats {
    this.updateStats();
    return { ...this.stats };
  }

  getTaskQueue(): TaskQueue {
    return this.taskQueue;
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}
