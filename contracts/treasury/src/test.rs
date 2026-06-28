#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, String,
};

fn setup() -> (Env, TreasuryContractClient<'static>, Address) {
    let env = Env::default();
    let contract_id = env.register(TreasuryContract, ());
    let client = TreasuryContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn initialize_sets_admin() {
    let (_env, client, admin) = setup();
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic]
fn initialize_twice_fails() {
    let (env, client, _admin) = setup();
    let other = Address::generate(&env);
    client.initialize(&other); // second initialize must panic (AlreadyInitialized)
}

#[test]
fn deposit_then_withdraw_tracks_balance() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();

    let tenant = String::from_str(&env, "tenant-uuid-1");
    let asset = symbol_short!("USDC");
    let strategy = symbol_short!("defindex");
    let hash = String::from_str(&env, "b3f1c0a9deadbeef");

    let after_deposit = client.record_flow(
        &tenant,
        &symbol_short!("deposit"),
        &asset,
        &20_000i128,
        &strategy,
        &hash,
    );
    assert_eq!(after_deposit, 20_000);
    // The deposit emitted exactly one LCP-bound event. Assert before any read
    // invocation: env.events().all() reflects the most recent contract call.
    assert_eq!(env.events().all().len(), 1);
    assert_eq!(client.balance(&tenant, &asset, &strategy), 20_000);

    let after_withdraw = client.record_flow(
        &tenant,
        &symbol_short!("withdraw"),
        &asset,
        &5_000i128,
        &strategy,
        &hash,
    );
    assert_eq!(after_withdraw, 15_000);
    // The withdraw is the most recent invocation → one event for it.
    assert_eq!(env.events().all().len(), 1);
}

#[test]
#[should_panic]
fn withdraw_more_than_balance_fails() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();
    let tenant = String::from_str(&env, "t");
    let asset = symbol_short!("USDC");
    let strategy = symbol_short!("blend");
    let hash = String::from_str(&env, "hash");
    client.record_flow(
        &tenant,
        &symbol_short!("withdraw"),
        &asset,
        &1i128,
        &strategy,
        &hash,
    );
}

#[test]
#[should_panic]
fn invalid_direction_fails() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();
    let tenant = String::from_str(&env, "t");
    client.record_flow(
        &tenant,
        &symbol_short!("sideways"),
        &symbol_short!("USDC"),
        &10i128,
        &symbol_short!("liq"),
        &String::from_str(&env, "h"),
    );
}

#[test]
#[should_panic]
fn non_positive_amount_fails() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();
    let tenant = String::from_str(&env, "t");
    client.record_flow(
        &tenant,
        &symbol_short!("deposit"),
        &symbol_short!("USDC"),
        &0i128,
        &symbol_short!("liq"),
        &String::from_str(&env, "h"),
    );
}
