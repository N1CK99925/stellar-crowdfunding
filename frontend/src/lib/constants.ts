// Default to the documented testnet contract from the README so the app works
// out of the box for the Yellow Belt submission.

export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';

export const CONTRACT_ID =
  import.meta.env.VITE_CONTRACT_ID || 'CBTUNIZMFD7RUVCNK2RTEAPRVHH5VQLKWSNWFERBHVAE64QSNHVS5353';

// Native XLM asset contract id on testnet (used for donations).
// This is the standard testnet XLM asset contract used in Soroban examples.
export const TOKEN_CONTRACT_ID =
  import.meta.env.VITE_TOKEN_CONTRACT_ID || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
