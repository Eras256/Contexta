import type { Logger } from "@contextio/shared";

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
  /**
   * Delay before the first run (default 0 = immediate). Used to interleave tasks
   * that sign with the same Stellar account so their transactions don't grab the
   * same sequence number and collide.
   */
  initialDelayMs?: number;
}

/**
 * Minimal in-process scheduler. Runs each task on its own interval, never lets a
 * slow tick overlap itself, and stops cleanly on shutdown. Adequate for a single
 * worker machine; swap for a distributed queue (e.g. pg-boss) when scaling out.
 */
export class Scheduler {
  private timers: (NodeJS.Timeout | number)[] = [];
  private running = new Set<string>();
  private stopped = false;

  constructor(private readonly logger: Logger) {}

  add(task: ScheduledTask): void {
    const tick = async () => {
      if (this.stopped || this.running.has(task.name)) return;
      this.running.add(task.name);
      const start = Date.now();
      try {
        await task.run();
      } catch (e) {
        this.logger.error({ task: task.name, err: String(e) }, "Task threw");
      } finally {
        this.running.delete(task.name);
        this.logger.debug({ task: task.name, ms: Date.now() - start }, "Task completed");
      }
    };

    if (task.initialDelayMs && task.initialDelayMs > 0) {
      const delayTimer = setTimeout(() => {
        if (this.stopped) return;
        void tick();
        const intervalTimer = setInterval(tick, task.intervalMs);
        this.timers.push(intervalTimer);
      }, task.initialDelayMs);
      this.timers.push(delayTimer);
    } else {
      // Kick off immediately, then on the interval.
      void tick();
      const intervalTimer = setInterval(tick, task.intervalMs);
      this.timers.push(intervalTimer);
    }
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.timers) {
      // Node timer objects are safe to pass to both clearTimeout and clearInterval
      clearTimeout(t as NodeJS.Timeout);
    }
    this.timers = [];
  }
}
