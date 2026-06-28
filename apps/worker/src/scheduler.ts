import type { Logger } from "@contexta/shared";

export interface ScheduledTask {
  name: string;
  intervalMs: number;
  run: () => Promise<void>;
}

/**
 * Minimal in-process scheduler. Runs each task on its own interval, never lets a
 * slow tick overlap itself, and stops cleanly on shutdown. Adequate for a single
 * worker machine; swap for a distributed queue (e.g. pg-boss) when scaling out.
 */
export class Scheduler {
  private timers: NodeJS.Timeout[] = [];
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
    // Kick off immediately, then on the interval.
    void tick();
    this.timers.push(setInterval(tick, task.intervalMs));
  }

  stop(): void {
    this.stopped = true;
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}
