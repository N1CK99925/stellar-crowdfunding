// ⚠️ Fill these in after you deploy the contract (see README "Deploy" step).

export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

// The contract id you get back from `stellar contract deploy`
export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID || 'PASTE_YOUR_CONTRACT_ID_HERE';

// Native XLM asset contract id on testnet (used for donations).
// You can get this with: stellar contract id asset --asset native --network testnet
export const TOKEN_CONTRACT_ID =
  import.meta.env.VITE_TOKEN_CONTRACT_ID || 'PASTE_NATIVE_XLM_CONTRACT_ID_HERE';
