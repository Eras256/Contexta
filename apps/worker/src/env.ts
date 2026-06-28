import { loadWorkerEnv, type WorkerEnv } from "@contexta/config";

let cached: WorkerEnv | null = null;

export function env(): WorkerEnv {
  if (!cached) cached = loadWorkerEnv();
  return cached;
}
