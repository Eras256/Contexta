import {
  Address,
  Contract,
  Keypair,
  nativeToScVal,
  rpc,
  scValToNative,
  TransactionBuilder,
  xdr,
  BASE_FEE,
  type Account,
} from "@stellar/stellar-sdk";
import { type NetworkConfig } from "./network.js";

/**
 * Thin, opinionated wrapper around @stellar/stellar-sdk's Soroban RPC client.
 * Centralizes the build → simulate/prepare → sign → send → poll lifecycle so
 * callers (treasury/payroll services) never reimplement it. Stellar-specific
 * correctness (network passphrase, fees, auth) is enforced here.
 */
export interface InvokeParams {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  /** Secret seed (S...) of the source account submitting the transaction. */
  sourceSecret: string;
  /** Max fee in stroops; defaults to a generous multiple of BASE_FEE for Soroban. */
  fee?: string;
  /** Poll timeout for transaction confirmation, ms. */
  timeoutMs?: number;
}

export interface InvokeResult {
  txHash: string;
  /** Decoded return value (native JS) when the call returns one. */
  returnValue: unknown;
  ledger: number;
}

export class StellarClient {
  readonly server: rpc.Server;
  readonly config: NetworkConfig;

  constructor(config: NetworkConfig) {
    this.config = config;
    this.server = new rpc.Server(config.rpcUrl, {
      allowHttp: config.rpcUrl.startsWith("http://"),
    });
  }

  static address(value: string): Address {
    return Address.fromString(value);
  }

  /** Convenience converters re-exported so callers don't import the SDK directly. */
  static toScVal = nativeToScVal;
  static fromScVal = scValToNative;

  async getAccount(publicKey: string): Promise<Account> {
    return this.server.getAccount(publicKey);
  }

  async getHealth(): Promise<{ status: string; latestLedger?: number }> {
    const health = (await this.server.getHealth()) as { status: string; latestLedger?: number };
    return { status: health.status, latestLedger: health.latestLedger };
  }

  /**
   * Build, simulate/prepare, sign, submit, and confirm a contract invocation.
   * Handles the common Soroban gotchas: footprint + resource fee come from
   * `prepareTransaction` (simulation), and we poll until the tx leaves PENDING.
   */
  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const keypair = Keypair.fromSecret(params.sourceSecret);
    const source = await this.server.getAccount(keypair.publicKey());
    const contract = new Contract(params.contractId);

    const built = new TransactionBuilder(source, {
      fee: params.fee ?? (Number(BASE_FEE) * 100).toString(),
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(params.method, ...(params.args ?? [])))
      .setTimeout(180)
      .build();

    // Simulation attaches the Soroban footprint + resource fees and surfaces
    // MissingValue / auth errors before we ever pay for submission.
    const prepared = await this.server.prepareTransaction(built);
    prepared.sign(keypair);

    const sent = await this.server.sendTransaction(prepared);
    if (sent.status === "ERROR") {
      throw new Error(`Stellar submission failed: ${JSON.stringify(sent.errorResult)}`);
    }

    const confirmed = await this.pollTransaction(sent.hash, params.timeoutMs ?? 30_000);
    if (confirmed.status !== "SUCCESS") {
      throw new Error(`Transaction ${sent.hash} did not succeed: ${confirmed.status}`);
    }

    return {
      txHash: sent.hash,
      returnValue: confirmed.returnValue ? scValToNative(confirmed.returnValue) : null,
      ledger: confirmed.ledger,
    };
  }

  /**
   * Read-only invocation via simulation only — no fees, no submission. Use for
   * view methods (balances, positions) where a ledger write isn't required.
   */
  async simulate(params: Omit<InvokeParams, "sourceSecret" | "fee">): Promise<unknown> {
    // A throwaway account is fine for read-only simulation.
    const probe = Keypair.random();
    const source = new (await import("@stellar/stellar-sdk")).Account(probe.publicKey(), "0");
    const contract = new Contract(params.contractId);
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(contract.call(params.method, ...(params.args ?? [])))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation error: ${sim.error}`);
    }
    const retval = sim.result?.retval;
    return retval ? scValToNative(retval) : null;
  }

  private async pollTransaction(
    hash: string,
    timeoutMs: number,
  ): Promise<rpc.Api.GetTransactionResponse & { ledger: number; returnValue?: xdr.ScVal }> {
    const deadline = Date.now() + timeoutMs;
    // Exponential-ish backoff bounded by the deadline.
    let delay = 500;
    for (;;) {
      const res = await this.server.getTransaction(hash);
      if (res.status !== "NOT_FOUND") {
        return res as never;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for transaction ${hash}`);
      }
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 4_000);
    }
  }

  /**
   * Stream recent contract events. Soroban RPC retains ~7 days of events; for
   * longer history the worker should persist them into Supabase as they arrive.
   */
  async getContractEvents(
    contractId: string,
    startLedger: number,
    limit = 100,
  ): Promise<rpc.Api.EventResponse[]> {
    const res = await this.server.getEvents({
      startLedger,
      filters: [{ type: "contract", contractIds: [contractId] }],
      limit,
    });
    return res.events;
  }
}

export { xdr, nativeToScVal, scValToNative, Address, Keypair };
