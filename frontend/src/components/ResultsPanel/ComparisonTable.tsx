import { formatMetricPercent, formatMoney } from "../../lib/format";
import type { BacktestResponse } from "../../types";

export interface ComparisonTableProps {
  data: BacktestResponse;
}

function freqLabel(freq: string): string {
  switch (freq) {
    case "daily":
      return "Diaria";
    case "weekly":
      return "Semanal";
    case "monthly":
      return "Mensual";
    default:
      return freq;
  }
}

export function ComparisonTable({ data }: ComparisonTableProps): JSX.Element {
  const { summary, metrics, lump_sum: lump } = data;
  const dcaBetter = metrics.return_pct >= lump.return_pct;
  const winnerDca = dcaBetter;
  const winnerLump = !dcaBetter;

  return (
    <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
      <div className="mb-3.5 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
        DCA vs Lump Sum
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          className={[
            "rounded-control border p-3.5 transition-colors md:px-4 md:py-3.5",
            winnerDca
              ? "border-positive bg-positive-bg"
              : "border-border bg-transparent",
          ].join(" ")}
        >
          <div
            className={[
              "mb-3 flex items-center justify-between border-b pb-2.5",
              winnerDca ? "border-positive/15" : "border-border",
            ].join(" ")}
          >
            <span className="text-[13px] font-semibold">
              DCA {freqLabel(summary.frequency)}
            </span>
            {winnerDca ? (
              <span className="rounded bg-positive px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                Mejor retorno
              </span>
            ) : null}
          </div>
          <div className="flex flex-col">
            <Row k="Capital total" v={formatMoney(metrics.total_invested)} />
            <Row k="Valor final" v={formatMoney(metrics.final_value)} />
            <Row
              k="Retorno"
              v={formatMetricPercent(metrics.return_pct)}
              green
            />
            <Row k="CAGR" v={formatMetricPercent(metrics.cagr_pct)} green />
            <Row
              k="Comisiones pagadas"
              v={formatMoney(metrics.total_commissions_paid, true)}
            />
          </div>
        </div>

        <div
          className={[
            "rounded-control border p-3.5 transition-colors md:px-4 md:py-3.5",
            winnerLump
              ? "border-positive bg-positive-bg"
              : "border-border bg-transparent",
          ].join(" ")}
        >
          <div
            className={[
              "mb-3 flex items-center justify-between border-b pb-2.5",
              winnerLump ? "border-positive/15" : "border-border",
            ].join(" ")}
          >
            <span className="text-[13px] font-semibold">Lump Sum</span>
            {winnerLump ? (
              <span className="rounded bg-positive px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                Mejor retorno
              </span>
            ) : null}
          </div>
          <div className="flex flex-col">
            <Row k="Capital total" v={formatMoney(lump.capital)} />
            <Row k="Valor final" v={formatMoney(lump.final_value)} />
            <Row k="Retorno" v={formatMetricPercent(lump.return_pct)} green />
            <Row k="CAGR" v={formatMetricPercent(lump.cagr_pct)} green />
            <Row
              k="Unidades compradas"
              v={lump.units_bought.toLocaleString("es-AR", {
                maximumFractionDigits: 6,
              })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  k,
  v,
  green,
}: {
  k: string;
  v: string;
  green?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-[13px] last:border-b-0">
      <span className="text-text-secondary">{k}</span>
      <span
        className={[
          "font-mono font-medium",
          green ? "text-positive" : "text-text-primary",
        ].join(" ")}
      >
        {v}
      </span>
    </div>
  );
}
