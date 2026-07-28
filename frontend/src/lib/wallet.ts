import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  ISupportedWallet,
} from '@creit.tech/stellar-wallets-kit';

// StellarWalletsKit gives us Freighter, xBull, Albedo, Lobstr, Hana, WalletConnect, etc.
// out of the box, each wrapped behind one consistent API.
export const kit: StellarWalletsKit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: undefined,
  modules: allowAllModules(),
});

export type WalletError =
  | { type: 'NOT_FOUND'; message: string }
  | { type: 'REJECTED'; message: string }
  | { type: 'UNKNOWN'; message: string };

/** Opens the wallet picker modal and stores the chosen wallet id. */
export function openWalletModal(onSelect: (option: ISupportedWallet) => void) {
  return kit.openModal({
    onWalletSelected: (option: ISupportedWallet) => {
      kit.setWallet(option.id);
      onSelect(option);
    },
  });
}

/** Fetches the public key of the connected wallet, normalising common errors. */
export async function getConnectedAddress(): Promise<string> {
  try {
    const { address } = await kit.getAddress();
    return address;
  } catch (err: any) {
    throw normaliseWalletError(err);
  }
}

/** Asks the connected wallet to sign a transaction XDR, normalising errors. */
export async function signTx(xdr: string, address: string): Promise<string> {
  try {
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      address,
      networkPassphrase: WalletNetwork.TESTNET,
    });
    return signedTxXdr;
  } catch (err: any) {
    throw normaliseWalletError(err);
  }
}

export function normaliseWalletError(err: any): WalletError {
  const message: string = err?.message || String(err);

  if (/not installed|not found|no wallet/i.test(message)) {
    return { type: 'NOT_FOUND', message: 'No compatible wallet was found. Please install Freighter, xBull, or another supported wallet.' };
  }
  if (/reject|denied|cancel/i.test(message)) {
    return { type: 'REJECTED', message: 'You rejected the request in your wallet.' };
  }
  return { type: 'UNKNOWN', message };
}
