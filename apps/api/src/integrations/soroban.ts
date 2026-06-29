import { type Logger, type Result, ok, err, stellar } from "@contextio/shared";
import type { LcpBinding } from "@contextio/shared/lcp";

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
  /** Stellar secret that funds real payroll payouts (the account holding USDC). */
  payoutSecret?: string;
  /** Classic issuer (G…) of the USDC used for payouts. */
  usdcIssuer?: string;
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
  /** Real per-employee USDC payouts (decimal amount, e.g. "45.00"). */
  payouts?: { destination: string; amount: string }[];
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
          StellarClient.toScVal(
            params.strategyRef.length > 32
              ? (params.strategyRef.includes("CCEB") ? "blend" : "defindex")
              : params.strategyRef,
            { type: "symbol" }
          ),
          StellarClient.toScVal(params.binding.hash, { type: "string" }),
        ],
      });
      return ok({ txHash: res.txHash });
    } catch (e) {
      return err(e instanceof Error ? e : new Error(String(e)));
    }
  }

  async executePayrollRun(params: PayrollRunParams): Promise<Result<{ txHash: string; payoutTxHash?: string }>> {
    if (!this.enabled || !this.config.payrollContractId) {
      return ok({ txHash: this.simulatedHash("payroll", params.runId) });
    }
    const { StellarClient, Keypair } = stellar;
    try {
      // 1. Real USDC payouts to each employee's Stellar wallet — the actual money.
      let payoutTxHash: string | undefined;
      const payouts = params.payouts ?? [];
      if (payouts.length > 0 && this.config.payoutSecret && this.config.usdcIssuer) {
        const sent = await this.client.sendPayments(
          this.config.payoutSecret,
          payouts.map((p) => ({
            destination: p.destination,
            assetCode: "USDC",
            assetIssuer: this.config.usdcIssuer as string,
            amount: p.amount,
          })),
        );
        payoutTxHash = sent.txHash;
        this.logger.info(
          { runId: params.runId, payoutTxHash, count: payouts.length },
          "Payroll USDC payouts sent on-chain",
        );
      }

      // 2. Record the run on-chain (LCP-bound). The agent triggers as the admin
      // (service) account; the contract records agent vs operator provenance.
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
      return ok({ txHash: res.txHash, payoutTxHash });
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
