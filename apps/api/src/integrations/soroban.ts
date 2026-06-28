import { type Logger, type Result, ok, err, stellar } from "@contexta/shared";
import type { LcpBinding } from "@contexta/shared/lcp";

/**
 * Gateway over the Treasury and Payroll Soroban contracts. Translates domain
 * actions into contract invocations and binds the LCP reference into every
 * agentic call. When contract ids / service secret are not configured it runs
 * in "simulation" mode and returns synthetic tx hashes so the rest of the
 * platform behaves identically against a not-yet-deployed chain.
 */
export interface SorobanConfig {
  treasuryContractId?: string;
  payrollContractId?: string;
  serviceSecret?: string;
}

export interface RecordFlowParams {
  tenantId: string;
  asset: string;
  amountBaseUnits: string;
  strategyRef: string;
  binding: LcpBinding;
}

export interface PayrollRunParams {
  tenantId: string;
  runId: string;
  totalBaseUnits: string;
  asset: string;
  employeeCount: number;
  binding: LcpBinding;
}

export class SorobanGateway {
  constructor(
    private readonly client: stellar.StellarClient,
    private readonly config: SorobanConfig,
    private readonly logger: Logger,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.serviceSecret);
  }

  async health(): Promise<Result<{ status: string; latestLedger?: number }>> {
    try {
      return ok(await this.client.getHealth());
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /**
   * Record a treasury deposit/withdrawal on-chain, emitting an event that
   * carries tenant, asset, amount, strategy ref and the LCP context hash.
   */
  async recordTreasuryFlow(
    direction: "deposit" | "withdraw",
    params: RecordFlowParams,
  ): Promise<Result<{ txHash: string }>> {
    if (!this.enabled || !this.config.treasuryContractId) {
      return ok({ txHash: this.simulatedHash("treasury", params.tenantId) });
    }
    const { StellarClient } = stellar;
    try {
      const res = await this.client.invoke({
        contractId: this.config.treasuryContractId,
        method: "record_flow",
        sourceSecret: this.config.serviceSecret!,
        args: [
          // Tenant + run ids are UUIDs (contain '-'), invalid as Soroban Symbols → String.
          StellarClient.toScVal(params.tenantId, { type: "string" }),
          StellarClient.toScVal(direction, { type: "symbol" }),
          StellarClient.toScVal(params.asset, { type: "symbol" }),
          StellarClient.toScVal(BigInt(params.amountBaseUnits), { type: "i128" }),
          // The contract's `strategy` param is a Soroban Symbol (≤32 chars, [a-zA-Z0-9_]),
          // not a String — passing a String here traps the VM (UnreachableCodeReached).
          StellarClient.toScVal(params.strategyRef, { type: "symbol" }),
          StellarClient.toScVal(params.binding.hash, { type: "string" }),
        ],
      });
      return ok({ txHash: res.txHash });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async executePayrollRun(params: PayrollRunParams): Promise<Result<{ txHash: string }>> {
    if (!this.enabled || !this.config.payrollContractId) {
      return ok({ txHash: this.simulatedHash("payroll", params.runId) });
    }
    const { StellarClient, Keypair } = stellar;
    try {
      // The agent triggers runs as the admin (service) account; the contract
      // distinguishes agent vs operator callers and records the provenance.
      const caller = Keypair.fromSecret(this.config.serviceSecret!).publicKey();
      const res = await this.client.invoke({
        contractId: this.config.payrollContractId,
        method: "execute_run",
        sourceSecret: this.config.serviceSecret!,
        args: [
          StellarClient.toScVal(caller, { type: "address" }),
          StellarClient.toScVal(params.tenantId, { type: "string" }),
          StellarClient.toScVal(params.runId, { type: "string" }),
          StellarClient.toScVal(BigInt(params.totalBaseUnits), { type: "i128" }),
          StellarClient.toScVal(params.asset, { type: "symbol" }),
          StellarClient.toScVal(params.employeeCount, { type: "u32" }),
          StellarClient.toScVal(params.binding.hash, { type: "string" }),
        ],
      });
      return ok({ txHash: res.txHash });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  /** Deterministic, clearly-fake hash for simulation mode (prefixed `sim:`). */
  private simulatedHash(kind: string, seed: string): string {
    const h = [...`${kind}:${seed}:${Date.now()}`].reduce(
      (a, c) => (a * 31 + c.charCodeAt(0)) >>> 0,
      7,
    );
    const hash = `sim:${kind}:${h.toString(16).padStart(8, "0")}`;
    this.logger.debug({ kind, seed, hash }, "Soroban simulation (no on-chain settlement)");
    return hash;
  }
}
