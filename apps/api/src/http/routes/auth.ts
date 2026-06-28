import { Router } from "express";
import { walletChallengeSchema, walletVerifySchema } from "../schemas.js";
import { AuthError } from "../../services/walletAuthService.js";

/**
 * Public wallet-authentication routes (no bearer required). Mounted before the
 * authenticated router so the challenge/verify handshake is reachable pre-login.
 */
export function authRouter(): Router {
  const router = Router();

  router.post("/wallet/challenge", (req, res, next) => {
    try {
      const { address } = walletChallengeSchema.parse(req.body);
      res.json(req.container.walletAuth.buildChallenge(address));
    } catch (e) {
      if (e instanceof AuthError) {
        res.status(400).json({ error: e.message });
        return;
      }
      next(e);
    }
  });

  router.post("/wallet/verify", async (req, res, next) => {
    try {
      const body = walletVerifySchema.parse(req.body);
      const session = await req.container.walletAuth.verify(body);
      res.json(session);
    } catch (e) {
      if (e instanceof AuthError) {
        res.status(401).json({ error: e.message });
        return;
      }
      next(e);
    }
  });

  return router;
}
