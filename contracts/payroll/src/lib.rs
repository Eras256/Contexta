#![no_std]
//! Contexta Payroll contract.
//!
//! Executes payroll runs on-chain as tamper-evident, LCP-bound events. Each run
//! is keyed by an off-chain run id (UUID from Supabase) so execution is
//! idempotent — re-submitting the same run id is rejected rather than paying twice.
//!
//! Runs may be triggered by the **agent** (platform service account, the admin)
//! or by an **operator** (e.g. a company admin's own wallet) added to an
//! allowlist. Both paths require the caller's authorization; the trigger type is
//! recorded in the emitted event for provenance.
//!
//! ## Deployment & upgrade
//! Deploy once per environment. Admin is the platform service account; operators
//! are added per tenant for user-triggered runs. Upgrade via
//! `update_current_contract_wasm` gated on admin auth (see contracts/README.md).

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 60 * DAY_IN_LEDGERS; // keep run records ~60 days
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Operator(Address),
    Run(String),
}

/// Event payload published on each executed run.
#[derive(Clone)]
#[contracttype]
pub struct RunEvent {
    pub tenant: String,
    pub run_id: String,
    pub total: i128,
    pub asset: Symbol,
    pub employee_count: u32,
    pub trigger: Symbol, // "agent" | "operator"
    pub lcp_hash: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    NotAuthorized = 3,
    AlreadyExecuted = 4,
    InvalidAmount = 5,
    InvalidEmployeeCount = 6,
}

#[contract]
pub struct PayrollContract;

#[contractimpl]
impl PayrollContract {
    /// Initialize with the platform service account as admin.
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Allow an additional address (e.g. a company admin wallet) to trigger runs.
    pub fn add_operator(env: Env, operator: Address) -> Result<(), Error> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Operator(operator.clone()), &true);
        env.storage().persistent().extend_ttl(
            &DataKey::Operator(operator),
            LIFETIME_THRESHOLD,
            BUMP_AMOUNT,
        );
        Ok(())
    }

    pub fn remove_operator(env: Env, operator: Address) -> Result<(), Error> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();
        env.storage()
            .persistent()
            .remove(&DataKey::Operator(operator));
        Ok(())
    }

    /// Execute a payroll run. Idempotent on `run_id`. `caller` must be the admin
    /// (agent) or an allowlisted operator (user); the trigger type is emitted.
    pub fn execute_run(
        env: Env,
        caller: Address,
        tenant: String,
        run_id: String,
        total: i128,
        asset: Symbol,
        employee_count: u32,
        lcp_hash: String,
    ) -> Result<(), Error> {
        caller.require_auth();

        let admin = Self::load_admin(&env)?;
        let trigger = if caller == admin {
            symbol_short!("agent")
        } else if env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Operator(caller.clone()))
            .unwrap_or(false)
        {
            symbol_short!("operator")
        } else {
            return Err(Error::NotAuthorized);
        };

        if total <= 0 {
            return Err(Error::InvalidAmount);
        }
        if employee_count == 0 {
            return Err(Error::InvalidEmployeeCount);
        }

        // Idempotency: a run id may settle exactly once.
        let run_key = DataKey::Run(run_id.clone());
        if env.storage().persistent().has(&run_key) {
            return Err(Error::AlreadyExecuted);
        }
        env.storage().persistent().set(&run_key, &true);
        env.storage()
            .persistent()
            .extend_ttl(&run_key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        env.events().publish(
            (
                symbol_short!("payroll"),
                symbol_short!("run"),
                trigger.clone(),
            ),
            RunEvent {
                tenant,
                run_id,
                total,
                asset,
                employee_count,
                trigger,
                lcp_hash,
            },
        );

        Ok(())
    }

    /// Whether a run id has already been executed (idempotency check for callers).
    pub fn run_executed(env: Env, run_id: String) -> bool {
        env.storage().persistent().has(&DataKey::Run(run_id))
    }

    pub fn is_operator(env: Env, who: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Operator(who))
            .unwrap_or(false)
    }

    pub fn admin(env: Env) -> Result<Address, Error> {
        Self::load_admin(&env)
    }

    fn load_admin(env: &Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }
}

mod test;
