# Contexta Soroban contracts

Two Rust/Soroban contracts settle the platform's agentic actions on Stellar and
bind each to a Legal Context Protocol (LCP) hash.

| Contract | Crate | Purpose |
| --- | --- | --- |
| `treasury/` | `contexta-treasury` | Records LCP-bound treasury flows (deposit/withdraw) across liquidity / DeFindex / Blend; enforces non-negative balances on-chain. |
| `payroll/` | `contexta-payroll` | Idempotent, LCP-bound payroll runs; supports agent (admin) and operator (user) triggers; prevents double payment per run id. |

Both are members of the workspace `Cargo.toml` at the repo root.

## Interfaces

### treasury
```
initialize(admin: Address)
record_flow(tenant: String, direction: Symbol /* deposit|withdraw */,
            asset: Symbol, amount: i128, strategy: Symbol, lcp_hash: String) -> i128
balance(tenant: String, asset: Symbol, strategy: Symbol) -> i128
admin() -> Address
```
Emits `("treasury", <direction>)` with `FlowEvent { tenant, asset, strategy, amount, lcp_hash }`.

### payroll
```
initialize(admin: Address)
add_operator(operator: Address)            // user-triggered runs
remove_operator(operator: Address)
execute_run(caller: Address, tenant: String, run_id: String, total: i128,
            asset: Symbol, employee_count: u32, lcp_hash: String)
run_executed(run_id: String) -> bool       // idempotency check
is_operator(who: Address) -> bool
admin() -> Address
```
Emits `("payroll", "run", <trigger>)` with `RunEvent { tenant, run_id, total, asset, employee_count, trigger, lcp_hash }`.

## Storage patterns / gotchas

- **No `MissingValue`:** every read uses `get(...).unwrap_or(default)` or `has(...)`.
- **TTL:** balances and run records use *persistent* storage and call
  `extend_ttl` on every write (~30–60 days), so an active treasury/payroll never
  lapses into an archived entry mid-operation.
- **Idempotency:** payroll runs are keyed by the off-chain `run_id` (UUID), so a
  retried submission is rejected (`AlreadyExecuted`) rather than paying twice.
- **Auth:** `treasury.record_flow` requires the admin; `payroll.execute_run`
  requires the caller (admin = agent, or an allowlisted operator = user).

## Build & test

```bash
# From the repo root (uses rust-toolchain.toml → wasm32 target):
cargo test                                   # unit tests (native, fast)
cargo build --release --target wasm32-unknown-unknown
# Optimize (optional, requires stellar CLI):
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/contexta_treasury.wasm
```

## Deploy to testnet

```bash
stellar keys generate svc --network testnet --fund
SVC=$(stellar keys address svc)

TREASURY_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contexta_treasury.wasm \
  --source svc --network testnet)
stellar contract invoke --id $TREASURY_ID --source svc --network testnet \
  -- initialize --admin $SVC

PAYROLL_ID=$(stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contexta_payroll.wasm \
  --source svc --network testnet)
stellar contract invoke --id $PAYROLL_ID --source svc --network testnet \
  -- initialize --admin $SVC
```

Set `TREASURY_CONTRACT_ID`, `PAYROLL_CONTRACT_ID`, and `STELLAR_SERVICE_SECRET`
in the API/worker env to switch the platform from simulation to live settlement.

## Upgrades (production)

Add an admin-gated upgrade entrypoint:

```rust
pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
    Self::load_admin(&env)?.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
    Ok(())
}
```

In a serious deployment the admin should be a multisig or smart account, and
upgrades should be timelocked. Omitted from the demo to keep the surface minimal.
