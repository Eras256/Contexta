import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { RATE_LIMIT, SECURITY_HEADERS, MAX_JSON_BODY_BYTES } from "@contexta/config";
import { env } from "./env.js";
import { createContainer, type Container } from "./container.js";
import { authMiddleware } from "./http/middleware/auth.js";
import { errorHandler, notFound } from "./http/middleware/error.js";
import { healthRouter } from "./http/routes/health.js";
import { treasuryRouter } from "./http/routes/treasury.js";
import { payrollRouter } from "./http/routes/payroll.js";
import { legalRouter, wellKnownRouter } from "./http/routes/legal.js";
import { agentRouter } from "./http/routes/agent.js";
import { integrationsRouter } from "./http/routes/integrations.js";
import { auditRouter } from "./http/routes/audit.js";

/**
 * Builds the Express app. Accepts an optional pre-built container so tests can
 * inject mocked dependencies without standing up real Supabase/Stellar.
 */
export function createApp(container: Container = createContainer()): Express {
  const config = env();
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Make the DI container available to every handler.
  app.use((req, _res, next) => {
    req.container = container;
    next();
  });

  // Structured request logging.
  app.use(pinoHttp({ logger: container.logger }));

  // Security headers (helmet + our explicit additions).
  app.use(helmet());
  app.use((_req, res, next) => {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    next();
  });

  app.use(
    cors({
      origin: config.CORS_ORIGINS.length > 0 ? config.CORS_ORIGINS : false,
      credentials: true,
      allowedHeaders: ["authorization", "content-type", "x-tenant-id", "x-internal-secret"],
    }),
  );

  app.use(express.json({ limit: MAX_JSON_BODY_BYTES }));

  // ── Public routes (no auth) ──────────────────────────────────────────────
  app.use("/", healthRouter());
  app.use("/.well-known", wellKnownRouter());

  // ── Authenticated API ────────────────────────────────────────────────────
  const api = express.Router();
  api.use(rateLimit({ windowMs: RATE_LIMIT.windowMs, max: RATE_LIMIT.max }));
  api.use(authMiddleware(config));

  api.use("/treasury", treasuryRouter());
  api.use("/payroll", payrollRouter());
  api.use("/legal", legalRouter());
  api.use(
    "/agent",
    rateLimit({ windowMs: RATE_LIMIT.sensitive.windowMs, max: RATE_LIMIT.sensitive.max }),
    agentRouter(),
  );
  api.use("/integrations", integrationsRouter());
  api.use("/audit", auditRouter());

  app.use("/api/v1", api);

  app.use(notFound);
  app.use(errorHandler());

  return app;
}
