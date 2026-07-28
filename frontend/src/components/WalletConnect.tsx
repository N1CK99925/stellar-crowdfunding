import { useState } from 'react';
import { openWalletModal, getConnectedAddress, WalletError } from '../lib/wallet';

type Props = {
  address: string | null;
  onConnected: (address: string) => void;
};

export default function WalletConnect({ address, onConnected }: Props) {
  const [error, setError] = useState<WalletError | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      await openWalletModal(async () => {
        try {
          const addr = await getConnectedAddress();
          onConnected(addr);
        } catch (err) {
          setError(err as WalletError);
        } finally {
          setConnecting(false);
        }
      });
    } catch (err) {
      setError(err as WalletError);
      setConnecting(false);
    }
  }

  if (address) {
    return (
      <div className="wallet-pill">
        <span className="dot" />
        {address.slice(0, 4)}...{address.slice(-4)}
      </div>
    );
  }

  return (
    <div>
      <button className="btn-primary" onClick={handleConnect} disabled={connecting}>
        {connecting ? 'Opening wallet…' : 'Connect Wallet'}
      </button>
      {error && (
        <p className={`error-text ${error.type.toLowerCase()}`}>
          {error.type === 'NOT_FOUND' && '🔌 '}
          {error.type === 'REJECTED' && '✋ '}
          {error.message}
        </p>
      )}
    </div>
  );
}
