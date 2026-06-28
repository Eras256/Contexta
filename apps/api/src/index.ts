import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { env } from "./env.js";

/**
 * Server bootstrap. Fails fast on invalid env (loaded inside createContainer),
 * binds the HTTP server, and wires graceful shutdown for Fly.io rolling deploys.
 */
function main(): void {
  const config = env();
  const container = createContainer();
  const app = createApp(container);

  const server = app.listen(config.API_PORT, config.API_HOST, () => {
    container.logger.info(
      { port: config.API_PORT, host: config.API_HOST, network: config.STELLAR_NETWORK },
      "Contextio API listening",
    );
  });

  const shutdown = (signal: string) => {
    container.logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
    // Force-exit if connections linger past the platform's grace period.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
