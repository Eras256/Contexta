#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, String,
};

fn setup() -> (Env, PayrollContractClient<'static>, Address) {
    let env = Env::default();
    let contract_id = env.register(PayrollContract, ());
    let client = PayrollContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize(&admin);
    (env, client, admin)
}

#[test]
fn agent_triggered_run_executes_once() {
    let (env, client, admin) = setup();
    env.mock_all_auths();

    let tenant = String::from_str(&env, "tenant-uuid-1");
    let run_id = String::from_str(&env, "run-uuid-1");
    let hash = String::from_str(&env, "b3f1c0a9deadbeef");

    client.execute_run(
        &admin,
        &tenant,
        &run_id,
        &156_000i128,
        &symbol_short!("USDC"),
        &4u32,
        &hash,
    );

    // Assert the emitted event before any read invocation (env.events().all()
    // reflects the most recent contract invocation in the test harness).
    assert_eq!(env.events().all().len(), 1);
    assert!(client.run_executed(&run_id));
}

#[test]
#[should_panic]
fn duplicate_run_id_is_rejected() {
    let (env, client, admin) = setup();
    env.mock_all_auths();
    let tenant = String::from_str(&env, "t");
    let run_id = String::from_str(&env, "run-1");
    let hash = String::from_str(&env, "h");
    let asset = symbol_short!("USDC");

    client.execute_run(&admin, &tenant, &run_id, &100i128, &asset, &1u32, &hash);
    // Same run id again must panic (AlreadyExecuted).
    client.execute_run(&admin, &tenant, &run_id, &100i128, &asset, &1u32, &hash);
}

#[test]
fn operator_can_trigger_after_allowlisting() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();

    let operator = Address::generate(&env);
    client.add_operator(&operator);
    assert!(client.is_operator(&operator));

    let tenant = String::from_str(&env, "t");
    let run_id = String::from_str(&env, "run-op-1");
    client.execute_run(
        &operator,
        &tenant,
        &run_id,
        &5_000i128,
        &symbol_short!("USDC"),
        &2u32,
        &String::from_str(&env, "h"),
    );
    assert!(client.run_executed(&run_id));
}

#[test]
#[should_panic]
fn unauthorized_caller_is_rejected() {
    let (env, client, _admin) = setup();
    env.mock_all_auths();

    let stranger = Address::generate(&env);
    client.execute_run(
        &stranger,
        &String::from_str(&env, "t"),
        &String::from_str(&env, "run-x"),
        &5_000i128,
        &symbol_short!("USDC"),
        &2u32,
        &String::from_str(&env, "h"),
    );
}

#[test]
#[should_panic]
fn zero_employee_count_is_rejected() {
    let (env, client, admin) = setup();
    env.mock_all_auths();
    client.execute_run(
        &admin,
        &String::from_str(&env, "t"),
        &String::from_str(&env, "run-z"),
        &5_000i128,
        &symbol_short!("USDC"),
        &0u32,
        &String::from_str(&env, "h"),
    );
}
