import { deriveRecentBuyRows } from "../../lib/deriveBuyRows";
import {
  formatMetricPercent,
  formatMoney,
  formatMonthYear,
} from "../../lib/format";
import type { BacktestResponse } from "../../types";
import { BacktestChart } from "../Chart/BacktestChart";
import { ComparisonTable } from "./ComparisonTable";
import { MetricCard } from "./MetricCard";

export interface ResultsPanelProps {
  data: BacktestResponse;
}

function amountSuffix(freq: string): string {
  if (freq === "daily") {
    return "día";
  }
  if (freq === "weekly") {
    return "sem.";
  }
  return "mes";
}

export function ResultsPanel({ data }: ResultsPanelProps): JSX.Element {
  const { summary, metrics } = data;
  const {
    amount_per_period: summaryAmountPerPeriod,
    frequency: summaryFrequency,
    total_periods: summaryTotalPeriods,
    commission_pct: summaryCommissionPct,
  } = summary;
  const buys = deriveRecentBuyRows(
    data.chart_data,
    summaryAmountPerPeriod,
    summaryCommissionPct,
    5,
  );

  const investedSub = `${summaryTotalPeriods} períodos · ${formatMoney(summaryAmountPerPeriod)}/${amountSuffix(summaryFrequency)}`;

  return (
    <section className="flex flex-col gap-4" aria-label="Resultados">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total invertido"
          value={formatMoney(metrics.total_invested)}
          sub={investedSub}
        />
        <MetricCard
          label="Valor final"
          value={formatMoney(metrics.final_value)}
          sub={formatMonthYear(summary.end_date)}
        />
        <MetricCard
          label="Retorno total"
          value={formatMetricPercent(metrics.return_pct)}
          sub={`${formatMoney(metrics.absolute_return, true)} absoluto`}
          positive={metrics.return_pct >= 0}
        />
        <MetricCard
          label="CAGR"
          value={formatMetricPercent(metrics.cagr_pct)}
          sub="anual compuesto"
          positive={metrics.cagr_pct >= 0}
        />
      </div>

      <BacktestChart data={data} />

      <ComparisonTable data={data} />

      <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
        <div className="mb-3.5 text-[11px] font-medium uppercase tracking-[0.07em] text-text-muted">
          Últimas compras ejecutadas
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-border pb-2.5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Fecha
                </th>
                <th className="border-b border-border pb-2.5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Precio
                </th>
                <th className="border-b border-border pb-2.5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Monto
                </th>
                <th className="border-b border-border pb-2.5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Comisión
                </th>
                <th className="border-b border-border pb-2.5 pr-3 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Unidades
                </th>
                <th className="border-b border-border pb-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-text-muted">
                  Valor portfolio
                </th>
              </tr>
            </thead>
            <tbody>
              {buys.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-sm text-text-muted"
                  >
                    No hay compras en el rango seleccionado.
                  </td>
                </tr>
              ) : (
                buys.map((row) => (
                  <tr key={row.date}>
                    <td className="border-b border-border py-2 pr-3 font-sans font-medium text-text-primary">
                      {row.date}
                    </td>
                    <td className="border-b border-border py-2 pr-3 font-mono text-text-secondary">
                      {formatMoney(row.price, true)}
                    </td>
                    <td className="border-b border-border py-2 pr-3 font-mono font-medium text-text-primary">
                      {formatMoney(row.amount, true)}
                    </td>
                    <td className="border-b border-border py-2 pr-3 font-mono text-text-secondary">
                      {formatMoney(row.commission, true)}
                    </td>
                    <td className="border-b border-border py-2 pr-3 font-mono text-text-secondary">
                      {row.units.toLocaleString("es-AR", {
                        maximumFractionDigits: 8,
                      })}
                    </td>
                    <td className="border-b border-border py-2 text-right font-mono font-medium text-positive">
                      {formatMoney(row.portfolioValue, true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
