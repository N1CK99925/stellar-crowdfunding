import { DonationEvent } from '../lib/contract';

type Props = {
  events: DonationEvent[];
};

export default function ActivityFeed({ events }: Props) {
  return (
    <div className="card">
      <h3>Live activity</h3>
      {events.length === 0 && <p className="muted">No donations yet — be the first!</p>}
      <ul className="feed">
        {events
          .slice()
          .reverse()
          .map((e, i) => (
            <li key={`${e.txHash}-${i}`}>
              <span className="feed-addr">
                {e.donor.slice(0, 4)}...{e.donor.slice(-4)}
              </span>{' '}
              donated <strong>{(Number(e.amount) / 10_000_000).toLocaleString()} XLM</strong>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${e.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="feed-link"
              >
                view tx
              </a>
            </li>
          ))}
      </ul>
    </div>
  );
}
