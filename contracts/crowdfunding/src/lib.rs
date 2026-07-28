#![no_std]

//! A tiny crowdfunding contract.
//!
//! - `initialize`  : set the campaign owner + funding goal (once)
//! - `donate`      : anyone can send XLM (native token) toward the goal
//! - `withdraw`    : owner pulls the funds once the goal is reached
//! - `get_info`    : read the current campaign state (goal, raised, donors)
//!
//! Every donation emits a `donation` event so the frontend can listen for
//! it and update the progress bar in real time instead of polling storage.

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol, Vec,
};

const CAMPAIGN: Symbol = symbol_short!("CAMPAIGN");

#[derive(Clone)]
#[contracttype]
pub struct Campaign {
    pub owner: Address,
    pub goal: i128,
    pub raised: i128,
    pub donors: Vec<Address>,
    pub token: Address,
    pub withdrawn: bool,
}

#[contract]
pub struct CrowdfundingContract;

#[contractimpl]
impl CrowdfundingContract {
    /// Set up the campaign. Can only be called once.
    pub fn initialize(env: Env, owner: Address, goal: i128, token: Address) {
        if env.storage().instance().has(&CAMPAIGN) {
            panic!("already initialized");
        }
        owner.require_auth();

        let campaign = Campaign {
            owner,
            goal,
            raised: 0,
            donors: Vec::new(&env),
            token,
            withdrawn: false,
        };
        env.storage().instance().set(&CAMPAIGN, &campaign);
    }

    /// Donate `amount` of the campaign token to the pool.
    /// `donor` must sign this call (StellarWalletsKit handles that in the UI).
    pub fn donate(env: Env, donor: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        donor.require_auth();

        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&CAMPAIGN)
            .expect("campaign not initialized");

        // Move the tokens from the donor to this contract.
        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        campaign.raised += amount;
        if !campaign.donors.contains(&donor) {
            campaign.donors.push_back(donor.clone());
        }
        env.storage().instance().set(&CAMPAIGN, &campaign);

        // Emit an event: topics = ("donation", donor), data = amount
        env.events()
            .publish((symbol_short!("donation"), donor), amount);
    }

    /// Owner withdraws the raised funds once the goal has been met.
    pub fn withdraw(env: Env) {
        let mut campaign: Campaign = env
            .storage()
            .instance()
            .get(&CAMPAIGN)
            .expect("campaign not initialized");

        campaign.owner.require_auth();

        if campaign.raised < campaign.goal {
            panic!("goal not reached yet");
        }
        if campaign.withdrawn {
            panic!("already withdrawn");
        }

        let token_client = token::Client::new(&env, &campaign.token);
        token_client.transfer(
            &env.current_contract_address(),
            &campaign.owner,
            &campaign.raised,
        );

        campaign.withdrawn = true;
        env.storage().instance().set(&CAMPAIGN, &campaign);

        env.events()
            .publish((symbol_short!("withdraw"),), campaign.raised);
    }

    /// Read-only: return the full campaign state.
    pub fn get_info(env: Env) -> Campaign {
        env.storage()
            .instance()
            .get(&CAMPAIGN)
            .expect("campaign not initialized")
    }
}

mod test;
