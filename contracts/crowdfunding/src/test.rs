#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    Env,
};

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, TokenClient<'a>, StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone());
    let address = contract_address.address();
    (
        address.clone(),
        TokenClient::new(env, &address),
        StellarAssetClient::new(env, &address),
    )
}

#[test]
fn test_donate_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();

    let owner = Address::generate(&env);
    let donor = Address::generate(&env);

    let (token_addr, token_client, token_admin) = create_token(&env, &owner);
    token_admin.mint(&donor, &1000);

    let contract_id = env.register_contract(None, CrowdfundingContract);
    let client = CrowdfundingContractClient::new(&env, &contract_id);

    client.initialize(&owner, &500, &token_addr);
    client.donate(&donor, &500);

    let info = client.get_info();
    assert_eq!(info.raised, 500);
    assert_eq!(info.donors.len(), 1);

    client.withdraw();
    let info = client.get_info();
    assert!(info.withdrawn);
    assert_eq!(token_client.balance(&owner), 500);
}
