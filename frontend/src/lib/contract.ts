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
    throw new Error(`Transaction submission failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const hash = sendResult.hash;

  try {
    await waitForTransactionConfirmation(hash, onStatus);
  } catch (err) {
    onStatus('error');
    throw err;
  }

  return { hash };
}

async function waitForTransactionConfirmation(
  hash: string,
  onStatus: (s: TxStatus) => void,
): Promise<void> {
  const timeoutMs = 30_000;
  const pollIntervalMs = 1_500;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    // The installed SDK is built against a Protocol-23-era stellar-base whose
    // `TransactionMeta` union only knows v0–v3, but the current testnet returns
    // `TransactionMetaV4` from `getTransaction`, which makes `server.getTransaction`
    // throw "Bad union switch: 4" for an already-applied transaction. Poll the raw
    // JSON-RPC response instead and only read the plain `status`/`resultXdr` fields.
    const tx = await rawGetTransaction(hash);

    if (tx.status === 'SUCCESS') {
      onStatus('success');
      return;
    }

    if (tx.status === 'FAILED') {
      const detail = tx.resultXdr ? `: ${tx.resultXdr}` : '';
      throw new Error(`Transaction failed on-chain${detail}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Transaction confirmation timed out: ${hash}`);
}

type RawGetTransaction = { status?: string; resultXdr?: string };

async function rawGetTransaction(hash: string): Promise<RawGetTransaction> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTransaction',
      params: { hash },
    }),
  });
  if (!res.ok) {
    throw new Error(`RPC getTransaction failed: HTTP ${res.status}`);
  }
  const payload = (await res.json()) as {
    result?: { status?: string; resultXdr?: string };
    error?: { message?: string };
  };
  if (payload.error) {
    throw new Error(`RPC getTransaction failed: ${payload.error.message}`);
  }
  return payload.result ?? {};
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

  const events: DonationEvent[] = [];

console.log(res.events);

for (const e of res.events) {
  try {
    events.push({
      donor: scValToNative(e.topic[1]),
      amount: scValToNative(e.value).toString(),
      ledger: e.ledger,
      txHash: e.txHash,
    });
  } catch (err) {
    console.error("Failed to decode event:", e, err);
  }
}

  return { events, latestLedger: res.latestLedger };
}

export { TOKEN_CONTRACT_ID };
