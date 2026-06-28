import { createServiceClient, createLogger, stellar, type Logger } from "@contextio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env.js";
import { Repository } from "./db/repository.js";
import { DefindexClient } from "./integrations/defindex.js";
import { BlendClient } from "./integrations/blend.js";
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
    { apiUrl: config.DEFINDEX_API_URL, apiKey: config.DEFINDEX_API_KEY || undefined },
    logger,
  );
  const blend = new BlendClient(
    {
      poolId: config.BLEND_POOL_CONTRACT_ID || undefined,
      oracleId: config.BLEND_ORACLE_CONTRACT_ID || undefined,
    },
    logger,
  );
  const soroban = new SorobanGateway(
    stellarClient,
    {
      treasuryContractId: config.TREASURY_CONTRACT_ID || undefined,
      payrollContractId: config.PAYROLL_CONTRACT_ID || undefined,
      serviceSecret: config.STELLAR_SERVICE_SECRET || undefined,
    },
    logger,
  );
  const oracle = createOracle(config, logger);

  const audit = new AuditService(repo);
  const legal = new LegalContextService(repo, logger);
  const treasury = new TreasuryService(repo, defindex, blend, soroban, legal, audit, logger);
  const payroll = new PayrollService(repo, soroban, legal, audit, logger);
  const agent = new AgentService(repo, treasury, payroll, oracle, legal, audit, logger);
  const walletAuth = new WalletAuthService(repo, config, logger);

  return {
    logger,
    supabase,
    repo,
    defindex,
    blend,
    soroban,
    oracle,
    audit,
    legal,
    treasury,
    payroll,
    agent,
    walletAuth,
  };
}
