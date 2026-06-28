import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { makeTestContainer } from "./fakeContainer.js";

const app = createApp(makeTestContainer());

function userToken(): string {
  return jwt.sign({ sub: "u1", email: "u@test" }, process.env.SUPABASE_JWT_SECRET!, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

describe("API HTTP layer", () => {
  it("exposes liveness without auth", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/v1/treasury").set("x-tenant-id", "t1");
    expect(res.status).toBe(401);
  });

  it("rejects when x-tenant-id is missing", async () => {
    const res = await request(app)
      .get("/api/v1/treasury")
      .set("authorization", `Bearer ${userToken()}`);
    expect(res.status).toBe(400);
  });

  it("allows an authenticated owner to read the treasury", async () => {
    const res = await request(app)
      .get("/api/v1/treasury")
      .set("authorization", `Bearer ${userToken()}`)
      .set("x-tenant-id", "t1");
    expect(res.status).toBe(200);
    expect(res.body.totals.totalBaseUnits).toBe("0");
  });

  it("accepts internal worker auth via shared secret", async () => {
    const res = await request(app)
      .get("/api/v1/agent/decisions")
      .set("x-internal-secret", process.env.INTERNAL_API_SECRET!)
      .set("x-tenant-id", "t1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns 404 with a clean body for unknown public routes", async () => {
    // A top-level unknown path falls through to the notFound handler. (Unknown
    // paths under /api/v1 are intercepted by auth first and return 401.)
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });
});
