/**
 * Vitest setup: provide a minimal valid environment so modules that call
 * loadServerEnv() at import time don't throw. Individual tests inject their own
 * fake container, so these values are never used to reach real services.
 */
process.env.NODE_ENV = "test";
process.env.SUPABASE_URL ??= "https://test.supabase.co";
process.env.SUPABASE_ANON_KEY ??= "anon";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "service";
process.env.SUPABASE_JWT_SECRET ??= "test-jwt-secret-please-change";
process.env.STELLAR_RPC_URL ??= "https://soroban-testnet.stellar.org";
process.env.STELLAR_HORIZON_URL ??= "https://horizon-testnet.stellar.org";
process.env.STELLAR_NETWORK_PASSPHRASE ??= "Test SDF Network ; September 2015";
process.env.INTERNAL_API_SECRET ??= "internal-secret-for-tests-1234567890";
