import { createServiceClient, createLogger, stellar, type Logger } from "@contextio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { Repository } from "./db/repository.js";
import { DefindexClient } from "./integrations/defindex.js";
import { BlendClient } from "./integrations/blend.js";
import { AiAdvisor } from "./integrations/ai.js";
import { SorobanGateway } from "./integrations/soroban.js";
import { createOracle, type Oracle } from "./integrations/oracle.js";
import { AuditService } from "./services/auditService.js";
import { LegalContextService } from "./services/legalContextService.js";
import { TreasuryService } from "./services/treasuryService.js";
import { PayrollService } from "./services/payrollService.js";
import { AgentService } from "./services/agentService.js";
import { WalletAuthService } from "./services/walletAuthService.js";

/**
 * Composition root. Everything is wired here once and injected downward, so
 * route handlers and services never reach for globals — this keeps them unit
 * testable with mocked dependencies.
 */
export interface Container {
  logger: Logger;
  supabase: SupabaseClient;
  repo: Repository;
  defindex: DefindexClient;
  blend: BlendClient;
  soroban: SorobanGateway;
  oracle: Oracle;
  ai: AiAdvisor;
  audit: AuditService;
  legal: LegalContextService;
  treasury: TreasuryService;
  payroll: PayrollService;
  agent: AgentService;
  walletAuth: WalletAuthService;
}

export function createContainer(): Container {
  const config = env();
  const logger = createLogger({ service: "api", level: config.LOG_LEVEL });

  const supabase = createServiceClient({
    url: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });
  const repo = new Repository(supabase);

  const stellarClient = new stellar.StellarClient({
    network: config.STELLAR_NETWORK,
    rpcUrl: config.STELLAR_RPC_URL,
    horizonUrl: config.STELLAR_HORIZON_URL,
    networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
  });

  const defindex = new DefindexClient(
    {
      apiUrl: config.DEFINDEX_API_URL,
      apiKey: config.DEFINDEX_API_KEY || undefined,
      network: config.DEFINDEX_NETWORK,
      vaultId: config.DEFINDEX_VAULT_ID || undefined,
      signerSecret: config.STELLAR_SERVICE_SECRET || undefined,
      networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
    },
    logger,
  );
  const blend = new BlendClient(
    {
      poolId: config.BLEND_POOL_CONTRACT_ID || undefined,
      oracleId: config.BLEND_ORACLE_CONTRACT_ID || undefined,
      backstopId: config.BLEND_BACKSTOP_CONTRACT_ID || undefined,
      asset: config.BLEND_ASSET_ID || undefined,
      rpcUrl: config.STELLAR_RPC_URL,
      networkPassphrase: config.STELLAR_NETWORK_PASSPHRASE,
      // Sign Blend ops with the account that holds the (Blend)USDC — the agent
      // wallet — falling back to the platform service key for XLM-only setups.
      signerSecret: config.BLEND_SIGNER_SECRET || config.STELLAR_SERVICE_SECRET || undefined,
    },
    stellarClient,
    logger,
  );
  const soroban = new SorobanGateway(
    stellarClient,
    {
      treasuryContractId: config.TREASURY_CONTRACT_ID || undefined,
      payrollContractId: config.PAYROLL_CONTRACT_ID || undefined,
      serviceSecret: config.STELLAR_SERVICE_SECRET || undefined,
      // Payroll payouts are funded by the account that holds the USDC (the agent
      // wallet, BLEND_SIGNER_SECRET); falls back to the service key.
      payoutSecret: config.BLEND_SIGNER_SECRET || config.STELLAR_SERVICE_SECRET || undefined,
      usdcIssuer: config.USDC_ISSUER || undefined,
    },
    logger,
  );
  const oracle = createOracle(config, logger);
  const ai = new AiAdvisor(
    {
      provider: config.AI_PROVIDER,
      model: config.AI_MODEL,
      apiKey: config.OPENAI_API_KEY || undefined,
      baseUrl: config.OPENAI_BASE_URL,
    },
    logger,
  );

  const audit = new AuditService(repo);
  const legal = new LegalContextService(repo, logger);
  const treasury = new TreasuryService(repo, defindex, blend, soroban, legal, audit, logger);
  const payroll = new PayrollService(repo, soroban, legal, audit, logger);
  const agent = new AgentService(repo, treasury, defindex, blend, payroll, oracle, legal, audit, ai, logger);
  const walletAuth = new WalletAuthService(repo, config, logger);

  return {
    logger,
    supabase,
    repo,
    defindex,
    blend,
    soroban,
    oracle,
    ai,
    audit,
    legal,
    treasury,
    payroll,
    agent,
    walletAuth,
  };
}
