export interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  positive?: boolean;
}

export function MetricCard({
  label,
  value,
  sub,
  positive,
}: MetricCardProps): JSX.Element {
  return (
    <div className="rounded-panel border border-border bg-surface p-4 shadow-panel transition-colors md:px-[18px] md:py-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-metric-label">
        {label}
      </div>
      <div
        className={[
          "text-2xl font-medium leading-none tracking-tight",
          positive ? "text-positive" : "text-text-primary",
        ].join(" ")}
      >
        {value}
      </div>
      {sub ? (
        <div className="mt-1.5 text-xs text-text-muted">{sub}</div>
      ) : null}
    </div>
  );
}
