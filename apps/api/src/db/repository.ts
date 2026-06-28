import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AgentDecision,
  AuditLog,
  PayrollEmployee,
  PayrollRun,
  PayrollSchedule,
  Tenant,
  TenantUser,
  TreasuryConfig,
  TreasuryPosition,
} from "@contexta/shared";

/**
 * Data access layer over Supabase (Postgres). Uses the service-role client and
 * therefore bypasses RLS — every method is reached only after the HTTP layer
 * has authenticated the caller and resolved their tenant role. Column names are
 * snake_case in Postgres; we map to camelCase domain types at this boundary.
 */
export class Repository {
  constructor(private readonly db: SupabaseClient) {}

  private static unwrap<T>(data: T | null, error: { message: string } | null, what: string): T {
    if (error) throw new Error(`DB error (${what}): ${error.message}`);
    if (data === null) throw new Error(`Not found: ${what}`);
    return data;
  }

  // ── Tenants & membership ────────────────────────────────────────────────
  async getTenant(tenantId: string): Promise<Tenant> {
    const { data, error } = await this.db.from("tenants").select("*").eq("id", tenantId).single();
    return mapTenant(Repository.unwrap(data, error, "getTenant"));
  }

  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const { data, error } = await this.db.from("tenants").select("*").eq("domain", domain).maybeSingle();
    if (error) throw new Error(`DB error (getTenantByDomain): ${error.message}`);
    return data ? mapTenant(data) : null;
  }

  async getMembership(tenantId: string, userId: string): Promise<TenantUser | null> {
    const { data, error } = await this.db
      .from("tenant_users")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`DB error (getMembership): ${error.message}`);
    return data
      ? {
          tenantId: data.tenant_id,
          userId: data.user_id,
          role: data.role,
          createdAt: data.created_at,
        }
      : null;
  }

  // ── Treasury ────────────────────────────────────────────────────────────
  async getTreasuryConfig(tenantId: string): Promise<TreasuryConfig | null> {
    const { data, error } = await this.db
      .from("treasuries")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (error) throw new Error(`DB error (getTreasuryConfig): ${error.message}`);
    return data ? mapTreasuryConfig(data) : null;
  }

  async upsertTreasuryConfig(config: TreasuryConfig): Promise<TreasuryConfig> {
    const { data, error } = await this.db
      .from("treasuries")
      .upsert({
        id: config.id,
        tenant_id: config.tenantId,
        min_liquidity_base_units: config.minLiquidityBaseUnits,
        max_yield_bps: config.maxYieldBps,
        country_limits_bps: config.countryLimitsBps,
        volatility_sensitivity: config.volatilitySensitivity,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    return mapTreasuryConfig(Repository.unwrap(data, error, "upsertTreasuryConfig"));
  }

  async listPositions(tenantId: string): Promise<TreasuryPosition[]> {
    const { data, error } = await this.db
      .from("treasury_positions")
      .select("*")
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`DB error (listPositions): ${error.message}`);
    return (data ?? []).map(mapPosition);
  }

  async upsertPosition(position: TreasuryPosition): Promise<void> {
    const { error } = await this.db.from("treasury_positions").upsert({
      id: position.id,
      tenant_id: position.tenantId,
      asset: position.asset,
      strategy: position.strategy,
      strategy_ref: position.strategyRef,
      amount_base_units: position.amountBaseUnits,
      apy_bps: position.apyBps,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`DB error (upsertPosition): ${error.message}`);
  }

  // ── Payroll ─────────────────────────────────────────────────────────────
  async listEmployees(tenantId: string): Promise<PayrollEmployee[]> {
    const { data, error } = await this.db
      .from("payroll_employees")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(`DB error (listEmployees): ${error.message}`);
    return (data ?? []).map(mapEmployee);
  }

  async getEmployee(tenantId: string, id: string): Promise<PayrollEmployee | null> {
    const { data, error } = await this.db
      .from("payroll_employees")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`DB error (getEmployee): ${error.message}`);
    return data ? mapEmployee(data) : null;
  }

  async upsertEmployee(e: PayrollEmployee): Promise<PayrollEmployee> {
    const { data, error } = await this.db
      .from("payroll_employees")
      .upsert({
        id: e.id,
        tenant_id: e.tenantId,
        full_name: e.fullName,
        email: e.email,
        country: e.country,
        wallet_address: e.walletAddress,
        bank_reference: e.bankReference,
        payout_asset: e.payoutAsset,
        preferred_rail: e.preferredRail,
        salary_amount: e.salaryAmount,
        active: e.active,
      })
      .select("*")
      .single();
    return mapEmployee(Repository.unwrap(data, error, "upsertEmployee"));
  }

  async deleteEmployee(tenantId: string, id: string): Promise<void> {
    const { error } = await this.db
      .from("payroll_employees")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", id);
    if (error) throw new Error(`DB error (deleteEmployee): ${error.message}`);
  }

  async listSchedules(tenantId: string): Promise<PayrollSchedule[]> {
    const { data, error } = await this.db
      .from("payroll_schedules")
      .select("*")
      .eq("tenant_id", tenantId);
    if (error) throw new Error(`DB error (listSchedules): ${error.message}`);
    return (data ?? []).map(mapSchedule);
  }

  async getSchedule(tenantId: string, id: string): Promise<PayrollSchedule | null> {
    const { data, error } = await this.db
      .from("payroll_schedules")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`DB error (getSchedule): ${error.message}`);
    return data ? mapSchedule(data) : null;
  }

  async upsertSchedule(s: PayrollSchedule): Promise<PayrollSchedule> {
    const { data, error } = await this.db
      .from("payroll_schedules")
      .upsert({
        id: s.id,
        tenant_id: s.tenantId,
        name: s.name,
        cadence: s.cadence,
        next_run_at: s.nextRunAt,
        asset: s.asset,
        rail: s.rail,
        employee_ids: s.employeeIds,
        active: s.active,
      })
      .select("*")
      .single();
    return mapSchedule(Repository.unwrap(data, error, "upsertSchedule"));
  }

  async dueSchedules(now: string): Promise<PayrollSchedule[]> {
    const { data, error } = await this.db
      .from("payroll_schedules")
      .select("*")
      .lte("next_run_at", now)
      .eq("active", true);
    if (error) throw new Error(`DB error (dueSchedules): ${error.message}`);
    return (data ?? []).map(mapSchedule);
  }

  async insertPayrollRun(run: PayrollRun): Promise<PayrollRun> {
    const { data, error } = await this.db
      .from("payroll_runs")
      .insert({
        id: run.id,
        tenant_id: run.tenantId,
        schedule_id: run.scheduleId,
        status: run.status,
        total_amount: run.totalAmount,
        asset: run.asset,
        lines: run.lines,
        legal_context_id: run.legalContextId,
        legal_context_hash: run.legalContextHash,
        stellar_tx_hash: run.stellarTxHash,
        executed_at: run.executedAt,
      })
      .select("*")
      .single();
    return mapRun(Repository.unwrap(data, error, "insertPayrollRun"));
  }

  async updatePayrollRun(id: string, patch: Partial<PayrollRun>): Promise<void> {
    const { error } = await this.db
      .from("payroll_runs")
      .update({
        status: patch.status,
        stellar_tx_hash: patch.stellarTxHash,
        legal_context_hash: patch.legalContextHash,
        executed_at: patch.executedAt,
        lines: patch.lines,
      })
      .eq("id", id);
    if (error) throw new Error(`DB error (updatePayrollRun): ${error.message}`);
  }

  async listRuns(tenantId: string): Promise<PayrollRun[]> {
    const { data, error } = await this.db
      .from("payroll_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`DB error (listRuns): ${error.message}`);
    return (data ?? []).map(mapRun);
  }

  // ── Agent decisions ─────────────────────────────────────────────────────
  async insertDecision(d: AgentDecision): Promise<AgentDecision> {
    const { data, error } = await this.db
      .from("agent_decisions")
      .insert({
        id: d.id,
        tenant_id: d.tenantId,
        action: d.action,
        rationale: d.rationale,
        payload: d.payload,
        status: d.status,
        legal_context_id: d.legalContextId,
        legal_context_hash: d.legalContextHash,
        stellar_tx_hash: d.stellarTxHash,
      })
      .select("*")
      .single();
    return mapDecision(Repository.unwrap(data, error, "insertDecision"));
  }

  async updateDecision(id: string, patch: Partial<AgentDecision>): Promise<void> {
    const { error } = await this.db
      .from("agent_decisions")
      .update({
        status: patch.status,
        stellar_tx_hash: patch.stellarTxHash,
        legal_context_hash: patch.legalContextHash,
        decided_at: patch.decidedAt,
      })
      .eq("id", id);
    if (error) throw new Error(`DB error (updateDecision): ${error.message}`);
  }

  async listDecisions(tenantId: string): Promise<AgentDecision[]> {
    const { data, error } = await this.db
      .from("agent_decisions")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(`DB error (listDecisions): ${error.message}`);
    return (data ?? []).map(mapDecision);
  }

  // ── Legal contexts ──────────────────────────────────────────────────────
  async getLegalContextByTenant(tenantId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from("legal_contexts")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`DB error (getLegalContextByTenant): ${error.message}`);
    return data ?? null;
  }

  async getLegalContextByDomain(domain: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db
      .from("legal_contexts")
      .select("*, tenants!inner(domain)")
      .eq("tenants.domain", domain)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`DB error (getLegalContextByDomain): ${error.message}`);
    return data ?? null;
  }

  async upsertLegalContext(row: {
    id: string;
    tenantId: string;
    contextId: string;
    version: number;
    document: Record<string, unknown>;
    hash: string;
  }): Promise<void> {
    const { error } = await this.db.from("legal_contexts").upsert({
      id: row.id,
      tenant_id: row.tenantId,
      context_id: row.contextId,
      version: row.version,
      document: row.document,
      hash: row.hash,
      published_at: new Date().toISOString(),
    });
    if (error) throw new Error(`DB error (upsertLegalContext): ${error.message}`);
  }

  // ── Audit ───────────────────────────────────────────────────────────────
  async insertAudit(log: AuditLog): Promise<void> {
    const { error } = await this.db.from("audit_logs").insert({
      id: log.id,
      tenant_id: log.tenantId,
      actor_id: log.actorId,
      actor_type: log.actorType,
      action: log.action,
      detail: log.detail,
      legal_context_id: log.legalContextId,
    });
    if (error) throw new Error(`DB error (insertAudit): ${error.message}`);
  }

  async listAudit(tenantId: string): Promise<AuditLog[]> {
    const { data, error } = await this.db
      .from("audit_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`DB error (listAudit): ${error.message}`);
    return (data ?? []).map(mapAudit);
  }
}

// ── snake_case → camelCase mappers ──────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function mapTenant(r: any): Tenant {
  return {
    id: r.id,
    name: r.name,
    domain: r.domain,
    country: r.country,
    legalContextId: r.legal_context_id ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
function mapTreasuryConfig(r: any): TreasuryConfig {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    minLiquidityBaseUnits: r.min_liquidity_base_units,
    maxYieldBps: r.max_yield_bps,
    countryLimitsBps: r.country_limits_bps ?? {},
    volatilitySensitivity: r.volatility_sensitivity,
    updatedAt: r.updated_at,
  };
}
function mapPosition(r: any): TreasuryPosition {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    asset: r.asset,
    strategy: r.strategy,
    strategyRef: r.strategy_ref ?? null,
    amountBaseUnits: r.amount_base_units,
    apyBps: r.apy_bps ?? null,
    updatedAt: r.updated_at,
  };
}
function mapEmployee(r: any): PayrollEmployee {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    fullName: r.full_name,
    email: r.email ?? null,
    country: r.country,
    walletAddress: r.wallet_address ?? null,
    bankReference: r.bank_reference ?? null,
    payoutAsset: r.payout_asset,
    preferredRail: r.preferred_rail,
    salaryAmount: r.salary_amount,
    active: r.active,
    createdAt: r.created_at,
  };
}
function mapSchedule(r: any): PayrollSchedule {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    cadence: r.cadence,
    nextRunAt: r.next_run_at,
    asset: r.asset,
    rail: r.rail,
    employeeIds: r.employee_ids ?? [],
    active: r.active,
    createdAt: r.created_at,
  };
}
function mapRun(r: any): PayrollRun {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    scheduleId: r.schedule_id ?? null,
    status: r.status,
    totalAmount: r.total_amount,
    asset: r.asset,
    lines: r.lines ?? [],
    legalContextId: r.legal_context_id ?? null,
    legalContextHash: r.legal_context_hash ?? null,
    stellarTxHash: r.stellar_tx_hash ?? null,
    executedAt: r.executed_at ?? null,
    createdAt: r.created_at,
  };
}
function mapDecision(r: any): AgentDecision {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    action: r.action,
    rationale: r.rationale,
    payload: r.payload ?? {},
    status: r.status,
    legalContextId: r.legal_context_id ?? null,
    legalContextHash: r.legal_context_hash ?? null,
    stellarTxHash: r.stellar_tx_hash ?? null,
    createdAt: r.created_at,
    decidedAt: r.decided_at ?? null,
  };
}
function mapAudit(r: any): AuditLog {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    actorId: r.actor_id ?? null,
    actorType: r.actor_type,
    action: r.action,
    detail: r.detail ?? {},
    legalContextId: r.legal_context_id ?? null,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
