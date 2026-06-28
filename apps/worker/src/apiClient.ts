import type { Logger } from "@contextio/shared";

/**
 * Calls the Contextio API as the internal agent, authenticating with the shared
 * INTERNAL_API_SECRET. The worker never writes to Supabase or Stellar directly
 * for agentic actions — it goes through the API so the same legal-context
 * enforcement, RBAC and audit logging apply to agent and human actors alike.
 */
export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly internalSecret: string,
    private readonly logger: Logger,
  ) {}

  private async call<T>(
    tenantId: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-internal-secret": this.internalSecret,
        "x-tenant-id": tenantId,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.debug({ tenantId, method, path, status: res.status }, "API call failed");
      throw new Error(`API ${method} ${path} -> ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  proposeRebalance(tenantId: string, execute: boolean): Promise<{ id: string; action: string }> {
    return this.call(tenantId, "POST", "/agent/propose", { execute });
  }

  obligations(tenantId: string): Promise<Array<{ scheduleId: string; nextRunAt: string }>> {
    return this.call(tenantId, "GET", "/payroll/obligations");
  }

  executeRun(tenantId: string, scheduleId: string, dryRun: boolean): Promise<{ id: string }> {
    return this.call(tenantId, "POST", "/payroll/runs", { scheduleId, dryRun });
  }

  stellarStatus(tenantId: string): Promise<unknown> {
    return this.call(tenantId, "GET", "/integrations/stellar/status");
  }

  yieldCycle(tenantId: string): Promise<{ id?: string; skipped?: boolean }> {
    return this.call(tenantId, "POST", "/agent/yield-cycle", {});
  }

  blendCycle(tenantId: string): Promise<{ id?: string; skipped?: boolean }> {
    return this.call(tenantId, "POST", "/agent/blend-cycle", {});
  }
}
