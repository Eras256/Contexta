import { randomUUID } from "node:crypto";
import type { AuditAction, AuditLog } from "@contextio/shared";
import type { Repository } from "../db/repository.js";

/** Thin helper that standardizes audit-log creation across services. */
export class AuditService {
  constructor(private readonly repo: Repository) {}

  async record(input: {
    tenantId: string;
    actorId: string | null;
    actorType: "user" | "agent" | "system";
    action: AuditAction;
    detail?: Record<string, unknown>;
    legalContextId?: string | null;
  }): Promise<void> {
    const log: AuditLog = {
      id: randomUUID(),
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      detail: input.detail ?? {},
      legalContextId: input.legalContextId ?? null,
      createdAt: new Date().toISOString(),
    };
    await this.repo.insertAudit(log);
  }

  list(tenantId: string): Promise<AuditLog[]> {
    return this.repo.listAudit(tenantId);
  }
}
