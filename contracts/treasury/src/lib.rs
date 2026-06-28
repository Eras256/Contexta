#![no_std]
//! Contexta Treasury contract.
//!
//! Records tenant treasury flows (deposits/withdrawals) across strategy buckets
//! — liquidity, DeFindex vaults, Blend pools — and emits an event for every flow
//! that carries the Legal Context Protocol (LCP) hash, so the legal basis of an
//! agentic action is verifiable on-chain.
//!
//! Off-chain Supabase remains the system of record for rich state; this contract
//! is the tamper-evident, auditable ledger of *what the agent did and under which
//! legal context*. Balances are tracked here so an on-chain invariant (no negative
//! balances) is enforced independent of the backend.
//!
//! ## Deployment & upgrade
//! Deploy once per environment; the admin is the platform service account (in a
//! serious deployment, a multisig or smart account). Upgrades use the standard
//! `update_current_contract_wasm` pattern gated on `admin.require_auth()` — left
//! out here to keep the demo surface minimal, but see contracts/README.md.

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol,
};

// ── Storage TTL tuning (avoids entries expiring → MissingValue on read) ──────
// ~5s ledgers → 17,280 ledgers/day. Persist balances for ~30 days and bump on
// every write so an active treasury never lapses.
const DAY_IN_LEDGERS: u32 = 17_280;
const BUMP_AMOUNT: u32 = 30 * DAY_IN_LEDGERS;
const LIFETIME_THRESHOLD: u32 = BUMP_AMOUNT - DAY_IN_LEDGERS;

#[derive(Clone)]
#[contracttype]
pub struct BalanceKey {
    pub tenant: String,
    pub asset: Symbol,
    pub strategy: Symbol,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Balance(BalanceKey),
}

/// Structured event payload published with every treasury flow. The `lcp_hash`
/// binds the settlement to a specific, verifiable legal-context version.
#[derive(Clone)]
#[contracttype]
pub struct FlowEvent {
    pub tenant: String,
    pub asset: Symbol,
    pub strategy: Symbol,
    pub amount: i128,
    pub lcp_hash: String,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    InvalidDirection = 3,
    InsufficientBalance = 4,
    InvalidAmount = 5,
}

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    /// Initialize the contract with an admin (the platform service account).
    pub fn initialize(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        Ok(())
    }

    /// Record a treasury flow and emit an LCP-bound event. Only the admin may
    /// call this; the agent acts through the admin (service) account.
    ///
    /// `direction` is `deposit` (into a strategy) or `withdraw` (back to liquidity).
    pub fn record_flow(
        env: Env,
        tenant: String,
        direction: Symbol,
        asset: Symbol,
        amount: i128,
        strategy: Symbol,
        lcp_hash: String,
    ) -> Result<i128, Error> {
        let admin = Self::load_admin(&env)?;
        admin.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let is_deposit = direction == symbol_short!("deposit");
        let is_withdraw = direction == symbol_short!("withdraw");
        if !is_deposit && !is_withdraw {
            return Err(Error::InvalidDirection);
        }

        let key = DataKey::Balance(BalanceKey {
            tenant: tenant.clone(),
            asset: asset.clone(),
            strategy: strategy.clone(),
        });
        // Read current balance, defaulting to 0 — never panics on a missing key.
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let next = if is_deposit {
            current + amount
        } else {
            if current < amount {
                return Err(Error::InsufficientBalance);
            }
            current - amount
        };

        env.storage().persistent().set(&key, &next);
        env.storage()
            .persistent()
            .extend_ttl(&key, LIFETIME_THRESHOLD, BUMP_AMOUNT);

        // Topics: ("treasury", <direction>). Data: full flow payload incl. LCP hash.
        env.events().publish(
            (symbol_short!("treasury"), direction),
            FlowEvent {
                tenant,
                asset,
                strategy,
                amount,
                lcp_hash,
            },
        );

        Ok(next)
    }

    /// Read a tenant's balance in a given asset + strategy bucket.
    pub fn balance(env: Env, tenant: String, asset: Symbol, strategy: Symbol) -> i128 {
        let key = DataKey::Balance(BalanceKey {
            tenant,
            asset,
            strategy,
        });
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    /// Return the configured admin address.
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
