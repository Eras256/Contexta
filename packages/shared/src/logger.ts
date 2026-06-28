import pino, { type Logger, type LoggerOptions } from "pino";

/**
 * Structured logger. JSON in production (Fly.io log shipping), pretty in dev.
 * Always carries a `service` field so multi-service logs are filterable.
 */
export interface LoggerConfig {
  service: string;
  level?: LoggerOptions["level"];
  pretty?: boolean;
}

const REDACT_PATHS = [
  "*.password",
  "*.secret",
  "*.token",
  "*.authorization",
  "req.headers.authorization",
  "*.SUPABASE_SERVICE_ROLE_KEY",
  "*.STELLAR_SERVICE_SECRET",
];

export function createLogger(config: LoggerConfig): Logger {
  const base: LoggerOptions = {
    level: config.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: config.service },
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (config.pretty ?? process.env.NODE_ENV === "development") {
    return pino({
      ...base,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
      },
    });
  }
  return pino(base);
}

export type { Logger };
