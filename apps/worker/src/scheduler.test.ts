import { describe, expect, it, vi } from "vitest";
import { createLogger } from "@contextio/shared";
import { Scheduler } from "./scheduler.js";

const logger = createLogger({ service: "worker-test", pretty: false, level: "silent" });

describe("Scheduler", () => {
  it("runs a task immediately on add", async () => {
    const scheduler = new Scheduler(logger);
    const run = vi.fn(async () => {});
    scheduler.add({ name: "t", intervalMs: 10_000, run });
    await new Promise((r) => setTimeout(r, 5));
    scheduler.stop();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not overlap a still-running task", async () => {
    const scheduler = new Scheduler(logger);
    let active = 0;
    let maxConcurrent = 0;
    const run = vi.fn(async () => {
      active += 1;
      maxConcurrent = Math.max(maxConcurrent, active);
      await new Promise((r) => setTimeout(r, 30));
      active -= 1;
    });
    scheduler.add({ name: "slow", intervalMs: 5, run });
    await new Promise((r) => setTimeout(r, 40));
    scheduler.stop();
    expect(maxConcurrent).toBe(1);
  });
});
