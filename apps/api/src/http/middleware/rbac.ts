import type { NextFunction, Request, Response } from "express";
import { can, type Capability } from "@contexta/config";
import { HttpError, requireCtx } from "../context.js";

/**
 * Capability gate. Each protected route declares the capability it needs; the
 * caller's tenant role is checked against the capability matrix in
 * @contexta/config. Keeps authorization declarative and centrally auditable.
 */
export function requireCapability(capability: Capability) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const ctx = requireCtx(req);
    if (!can(ctx.role, capability)) {
      next(new HttpError(403, `Role '${ctx.role}' lacks capability '${capability}'`));
      return;
    }
    next();
  };
}
