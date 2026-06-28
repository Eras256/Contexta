import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../context.js";

/** Final error handler. Maps known error shapes to clean JSON responses. */
export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof ZodError) {
      res.status(422).json({
        error: "validation_error",
        issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      });
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, detail: err.detail });
      return;
    }
    const message = err instanceof Error ? err.message : "Internal error";
    // Legal-context enforcement failures surface as 412 Precondition Failed.
    if (/legal context/i.test(message)) {
      res.status(412).json({ error: "legal_context_required", message });
      return;
    }
    req.container?.logger?.error({ err: message }, "Unhandled error");
    res.status(500).json({ error: "internal_error" });
  };
}

/** 404 fallthrough. */
export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: "not_found", path: req.path });
}
