import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  Account,
  Keypair,
} from '@stellar/stellar-sdk';
import { CONTRACT_ID, TOKEN_CONTRACT_ID, NETWORK_PASSPHRASE, RPC_URL } from './constants';
import { signTx } from './wallet';

export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });

export type CampaignInfo = {
  owner: string;
  goal: bigint;
  raised: bigint;
  donors: string[];
  token: string;
  withdrawn: boolean;
};

/**
 * Simple, read-only call: fetches current campaign state without needing a
 * connected wallet. Soroban read calls still need a "source account" object
 * to simulate against, so we just use a random throwaway keypair — it never
 * signs or pays for anything.
 */
export async function getCampaignInfo(): Promise<CampaignInfo> {
  const contract = new Contract(CONTRACT_ID);
  const source = new Account(Keypair.random().publicKey(), '0');

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call('get_info'))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const result = SorobanRpc.Api.isSimulationSuccess(sim) ? sim.result?.retval : undefined;
  if (!result) throw new Error('No result returned from simulation');

  const native = scValToNative(result);
  return {
    owner: native.owner,
    goal: BigInt(native.goal),
    raised: BigInt(native.raised),
    donors: native.donors,
    token: native.token,
    withdrawn: native.withdrawn,
  };
}

export type TxStatus = 'idle' | 'building' | 'pending' | 'success' | 'error';

/**
 * Builds, signs (via the connected wallet), and submits a `donate` call.
 * `onStatus` lets the UI show live pending/success/fail state.
 */
export async function donate(
  donorAddress: string,
  amountStroops: bigint,
  onStatus: (s: TxStatus) => void,
): Promise<{ hash: string }> {
  onStatus('building');
  const account = await server.getAccount(donorAddress);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'donate',
        Address.fromString(donorAddress).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' }),
      ),
    )
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  const signedXdr = await signTx(prepared.toXDR(), donorAddress);

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  onStatus('pending');
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === 'ERROR') {
    onStatus('error');
    throw new Error('Transaction submission failed: ' + JSON.stringify(sendResult.errorResult));
  }

  // Poll until the network confirms it.
  let status = await server.getTransaction(sendResult.hash);
  while (status.status === 'NOT_FOUND') {
    await new Promise((r) => setTimeout(r, 1500));
    status = await server.getTransaction(sendResult.hash);
  }

  if (status.status === 'SUCCESS') {
    onStatus('success');
  } else {
    onStatus('error');
    throw new Error('Transaction failed on-chain: ' + status.status);
  }

  return { hash: sendResult.hash };
}

export type DonationEvent = {
  donor: string;
  amount: string;
  ledger: number;
  txHash: string;
};

/**
 * Polls Soroban RPC `getEvents` for `donation` events emitted by our contract.
 * This is what powers the "real-time" activity feed / progress bar without
 * needing a full websocket backend.
 */
export async function pollDonationEvents(
  sinceLedger: number,
): Promise<{ events: DonationEvent[]; latestLedger: number }> {
  const res = await server.getEvents({
    startLedger: sinceLedger,
    filters: [
      {
        type: 'contract',
        contractIds: [CONTRACT_ID],
        topics: [[nativeToScVal('donation', { type: 'symbol' }).toXDR('base64')]],
      },
    ],
    limit: 50,
  });

  const events: DonationEvent[] = res.events.map((e: any) => ({
    donor: scValToNative(e.topic[1]),
    amount: scValToNative(e.value).toString(),
    ledger: e.ledger,
    txHash: e.txHash,
  }));

  return { events, latestLedger: res.latestLedger };
}

export { TOKEN_CONTRACT_ID };
