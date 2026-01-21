import { v4 as uuidv4 } from 'uuid';
import { Task, TaskResult } from './types.js';
import { logger } from '../utils/logger.js';

export class TaskQueue {
  private queue: Task[] = [];
  private runningTasks: Map<string, Task> = new Map();
  private completedTasks: Map<string, TaskResult> = new Map();
  private taskDurations: number[] = [];

  addTask(task: Omit<Task, 'id' | 'createdAt' | 'status' | 'retryCount'>): string {
    const newTask: Task = {
      ...task,
      id: uuidv4(),
      createdAt: new Date(),
      status: 'pending',
      retryCount: 0,
    };

    this.queue.push(newTask);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

    logger.debug(`Task added to queue: ${newTask.id} (${newTask.type})`);
    return newTask.id;
  }

  addTasks(tasks: Omit<Task, 'id' | 'createdAt' | 'status' | 'retryCount'>[]): string[] {
    return tasks.map((task) => this.addTask(task));
  }

  getNextTask(): Task | null {
    if (this.queue.length === 0) {
      return null;
    }

    const task = this.queue.shift()!;
    task.status = 'running';
    task.startedAt = new Date();
    this.runningTasks.set(task.id, task);

    logger.debug(`Task started: ${task.id} (${task.type})`);
    return task;
  }

  getNextTasks(count: number): Task[] {
    const tasks: Task[] = [];
    for (let i = 0; i < count && this.queue.length > 0; i++) {
      const task = this.getNextTask();
      if (task) {
        tasks.push(task);
      }
    }
    return tasks;
  }

  completeTask(taskId: string, result: Omit<TaskResult, 'taskId'>): void {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found in running tasks: ${taskId}`);
      return;
    }

    task.status = 'completed';
    task.completedAt = new Date();

    const duration = task.completedAt.getTime() - (task.startedAt?.getTime() || task.createdAt.getTime());
    this.taskDurations.push(duration);
    if (this.taskDurations.length > 100) {
      this.taskDurations.shift();
    }

    this.runningTasks.delete(taskId);
    this.completedTasks.set(taskId, { ...result, taskId, duration });

    logger.debug(`Task completed: ${taskId} (${task.type}) in ${duration}ms`);
  }

  failTask(taskId: string, error: string): void {
    const task = this.runningTasks.get(taskId);
    if (!task) {
      logger.warn(`Task not found in running tasks: ${taskId}`);
      return;
    }

    task.retryCount++;

    if (task.retryCount < task.maxRetries) {
      // Requeue the task
      task.status = 'pending';
      task.startedAt = undefined;
      task.error = error;
      this.runningTasks.delete(taskId);
      this.queue.push(task);
      this.queue.sort((a, b) => b.priority - a.priority);

      logger.debug(`Task requeued: ${taskId} (retry ${task.retryCount}/${task.maxRetries})`);
    } else {
      // Mark as failed
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error;

      const duration = task.completedAt.getTime() - (task.startedAt?.getTime() || task.createdAt.getTime());
      this.runningTasks.delete(taskId);
      this.completedTasks.set(taskId, {
        taskId,
        success: false,
        error,
        duration,
      });

      logger.error(`Task failed: ${taskId} (${task.type}) - ${error}`);
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  getRunningTaskCount(): number {
    return this.runningTasks.size;
  }

  getCompletedTaskCount(): number {
    return this.completedTasks.size;
  }

  getTask(taskId: string): Task | null {
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      return runningTask;
    }

    const queuedTask = this.queue.find((t) => t.id === taskId);
    if (queuedTask) {
      return queuedTask;
    }

    return null;
  }

  getTaskResult(taskId: string): TaskResult | null {
    return this.completedTasks.get(taskId) || null;
  }

  clearCompleted(): void {
    this.completedTasks.clear();
    logger.debug('Completed tasks cleared');
  }

  clearAll(): void {
    this.queue = [];
    this.runningTasks.clear();
    this.completedTasks.clear();
    this.taskDurations = [];
    logger.debug('All tasks cleared');
  }

  getAverageTaskDuration(): number {
    if (this.taskDurations.length === 0) {
      return 0;
    }
    const sum = this.taskDurations.reduce((a, b) => a + b, 0);
    return sum / this.taskDurations.length;
  }

  getStats() {
    return {
      queueLength: this.queue.length,
      runningTasks: this.runningTasks.size,
      completedTasks: this.completedTasks.size,
      averageDuration: this.getAverageTaskDuration(),
    };
  }
}
