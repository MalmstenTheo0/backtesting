import type { ChartPoint } from "../types";

/**
 * Filas de compras derivadas de chart_data + summary (DCA monto fijo).
 * Si el API expone buy_events en el futuro, sustituir esta derivación.
 */
export function deriveRecentBuyRows(
  chartData: ChartPoint[],
  amountPerPeriod: number,
  commissionPct: number,
  limit = 5,
): {
  date: string;
  price: number;
  amount: number;
  commission: number;
  units: number;
  portfolioValue: number;
}[] {
  const rows = chartData
    .filter((p) => p.is_buy)
    .map((p) => {
      const commission = amountPerPeriod * (commissionPct / 100);
      const units =
        p.price > 0 ? (amountPerPeriod - commission) / p.price : 0;
      return {
        date: p.date,
        price: p.price,
        amount: amountPerPeriod,
        commission,
        units,
        portfolioValue: p.portfolio_value,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return rows.slice(0, limit);
}
