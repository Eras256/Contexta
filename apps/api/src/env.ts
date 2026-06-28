import { loadServerEnv, type ServerEnv } from "@contexta/config";

let cached: ServerEnv | null = null;

/** Loads and caches the validated server environment. Throws on first invalid boot. */
export function env(): ServerEnv {
  if (!cached) cached = loadServerEnv();
  return cached;
}
