import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { BacktestResponse } from "../../types";
import { ChartTooltip } from "./ChartTooltip";

export interface BacktestChartProps {
  data: BacktestResponse;
}

export function BacktestChart({ data }: BacktestChartProps): JSX.Element {
  const chartData = data.chart_data;

  return (
    <div
      className="rounded-panel border border-border bg-surface p-5 shadow-panel"
      data-testid="backtest-chart"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-text-muted">
          Evolución del portfolio
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-5 rounded-sm"
              style={{ background: "var(--chart-portfolio)" }}
            />
            Valor portfolio
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0 w-5 border-t-2 border-dashed"
              style={{ borderColor: "var(--chart-invested)" }}
            />
            Capital invertido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-5 rounded-sm"
              style={{ background: "var(--chart-price)" }}
            />
            Precio activo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full border-2 border-[var(--surface)]"
              style={{
                background: "var(--chart-portfolio)",
                boxShadow: "0 0 0 1px var(--chart-portfolio)",
              }}
            />
            Compra
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeWidth={0.5}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={{ stroke: "var(--border)" }}
            axisLine={{ stroke: "var(--border)" }}
            minTickGap={32}
            tickFormatter={(v: string) => {
              const [y, m] = v.split("-");
              return `${m}/${y?.slice(2) ?? ""}`;
            }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={{ stroke: "var(--border)" }}
            axisLine={{ stroke: "var(--border)" }}
            tickFormatter={(v: number) =>
              `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
            }
            width={56}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            tick={{ fill: "var(--chart-price)", fontSize: 11 }}
            tickLine={{ stroke: "var(--chart-price)" }}
            axisLine={false}
            tickFormatter={(v: number) =>
              `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
            }
            width={48}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="portfolio_value"
            name="Valor portfolio"
            stroke="var(--chart-portfolio)"
            strokeWidth={2}
            dot={BuyDot}
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="invested"
            name="Capital invertido"
            stroke="var(--chart-invested)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="Precio activo"
            stroke="var(--chart-price)"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BuyDot(props: any): JSX.Element {
  const { cx, cy, payload } = props;
  if (!payload?.is_buy || cx == null || cy == null) {
    return <g />;
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="var(--chart-portfolio)"
      stroke="var(--surface)"
      strokeWidth={2}
    />
  );
}
