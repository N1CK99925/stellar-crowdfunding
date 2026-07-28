type Props = {
  raised: bigint;
  goal: bigint;
};

export default function ProgressBar({ raised, goal }: Props) {
  const pct = goal > 0n ? Math.min(100, Number((raised * 100n) / goal)) : 0;
  const raisedXlm = Number(raised) / 10_000_000;
  const goalXlm = Number(goal) / 10_000_000;

  return (
    <div className="card">
      <h3>Campaign progress</h3>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="progress-label">
        {raisedXlm.toLocaleString()} / {goalXlm.toLocaleString()} XLM raised ({pct}%)
      </p>
    </div>
  );
}
