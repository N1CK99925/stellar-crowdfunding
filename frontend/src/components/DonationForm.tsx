import { useState } from 'react';
import { donate, TxStatus } from '../lib/contract';
import { normaliseWalletError } from '../lib/wallet';

type Props = {
  address: string | null;
  onDonated: () => void;
};

const STROOP = 10_000_000n; // 1 XLM = 10,000,000 stroops

export default function DonationForm({ address, onDonated }: Props) {
  const [amount, setAmount] = useState('10');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function handleDonate() {
    if (!address) {
      setErrorMsg('Connect a wallet first.');
      return;
    }
    const xlm = Number(amount);
    if (!xlm || xlm <= 0) {
      setErrorMsg('Enter a valid amount.');
      return;
    }

    setErrorMsg(null);
    setTxHash(null);

    try {
      const stroops = BigInt(Math.round(xlm * 10_000_000)) as bigint;
      const { hash } = await donate(address, stroops, setStatus);
      setTxHash(hash);
      onDonated();
    } catch (err: any) {
      setStatus('error');
      const message: string = err?.message || String(err);

      // Third error type: insufficient balance, surfaced from the
      // simulation/submission result rather than a generic failure.
      if (/insufficient|underfunded|balance/i.test(message)) {
        setErrorMsg('Insufficient balance to complete this donation.');
      } else if (/reject|denied|cancel/i.test(message)) {
        setErrorMsg(normaliseWalletError(err).message);
      } else {
        setErrorMsg(message);
      }
    }
  }

  return (
    <div className="card">
      <h3>Make a donation</h3>
      <div className="donate-row">
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={status === 'pending' || status === 'building'}
        />
        <span>XLM</span>
        <button
          className="btn-primary"
          onClick={handleDonate}
          disabled={!address || status === 'pending' || status === 'building'}
        >
          {status === 'building' && 'Preparing…'}
          {status === 'pending' && 'Confirming…'}
          {(status === 'idle' || status === 'success' || status === 'error') && 'Donate'}
        </button>
      </div>

      <StatusBadge status={status} />

      {errorMsg && <p className="error-text">⚠️ {errorMsg}</p>}

      {txHash && (
        <p className="tx-link">
          ✅ Confirmed —{' '}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            view on Stellar Expert
          </a>
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TxStatus }) {
  if (status === 'idle') return null;
  const label: Record<TxStatus, string> = {
    idle: '',
    building: 'Building transaction…',
    pending: 'Pending confirmation…',
    success: 'Success',
    error: 'Failed',
  };
  return <div className={`status-badge status-${status}`}>{label[status]}</div>;
}
