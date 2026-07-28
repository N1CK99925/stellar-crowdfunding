import { useEffect, useRef, useState } from 'react';
import WalletConnect from './components/WalletConnect';
import DonationForm from './components/DonationForm';
import ProgressBar from './components/ProgressBar';
import ActivityFeed from './components/ActivityFeed';
import { getCampaignInfo, pollDonationEvents, CampaignInfo, DonationEvent, server } from './lib/contract';

export default function App() {
  const [address, setAddress] = useState<string | null>(null);
  const [info, setInfo] = useState<CampaignInfo | null>(null);
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastLedger = useRef<number>(0);

  async function refresh() {
    try {
      const data = await getCampaignInfo();
      setInfo(data);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(
        'Could not load campaign data. Make sure CONTRACT_ID in src/lib/constants.ts is set to your deployed contract.',
      );
    }
  }

  // Initial load + set the ledger cursor for event polling.
  useEffect(() => {
    refresh();
    server
      .getLatestLedger()
      .then((l) => {
        lastLedger.current = Math.max(1, l.sequence - 100);
      })
      .catch(() => {});
  }, []);

  // Real-time sync: poll for new `donation` events every 5s and merge them in.
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { events: newEvents, latestLedger } = await pollDonationEvents(lastLedger.current);
        if (newEvents.length > 0) {
          setEvents((prev) => [...prev, ...newEvents]);
          refresh();
        }
        lastLedger.current = latestLedger + 1;
      } catch {
        // Non-fatal: RPC event polling can be flaky on public testnet nodes.
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="app">
      <header>
        <h1>🚀 Testnet Crowdfunding</h1>
        <WalletConnect address={address} onConnected={setAddress} />
      </header>

      {loadError && <p className="error-text">⚠️ {loadError}</p>}

      {info && (
        <>
          <ProgressBar raised={info.raised} goal={info.goal} />
          <DonationForm address={address} onDonated={refresh} />
          <ActivityFeed events={events} />
        </>
      )}

      <footer>
        Built on <a href="https://stellar.org" target="_blank" rel="noreferrer">Stellar</a> Soroban · Testnet only
      </footer>
    </div>
  );
}
