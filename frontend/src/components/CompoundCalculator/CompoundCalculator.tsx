import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { MetricCard } from "../ResultsPanel/MetricCard";

type Compounding = "annual" | "semiannual" | "quarterly" | "monthly";

type ContributionFrequency = "weekly" | "monthly";

const COMPOUNDING_OPTIONS: { value: Compounding; label: string }[] = [
  { value: "annual", label: "Anual" },
  { value: "semiannual", label: "Semestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "monthly", label: "Mensual" },
];

const CONTRIBUTION_FREQUENCY_OPTIONS: {
  value: ContributionFrequency;
  label: string;
}[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

const INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-control border border-border-strong bg-surface-2 px-2.5 text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]";

function monthlyEquivalentRate(rAnnual: number, comp: Compounding): number {
  switch (comp) {
    case "annual":
      return (1 + rAnnual) ** (1 / 12) - 1;
    case "semiannual":
      return (1 + rAnnual / 2) ** (1 / 6) - 1;
    case "quarterly":
      return (1 + rAnnual / 4) ** (1 / 3) - 1;
    case "monthly":
      return rAnnual / 12;
    default:
      return rAnnual / 12;
  }
}

function normalizeMonthlyContribution(
  amount: number,
  frequency: ContributionFrequency,
): number {
  if (frequency === "weekly") {
    return (amount * 52) / 12;
  }
  return amount;
}

function parseNum(raw: string, fallback: number): number {
  const t = raw.trim().replace(",", ".");
  if (t === "") {
    return fallback;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : fallback;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

function formatUsd2(n: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatMult(n: number): string {
  if (!Number.isFinite(n) || n === 0) {
    return "—";
  }
  return `${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}×`;
}

interface YearChartRow {
  year: number;
  capital: number;
  contributed: number;
}

interface YearTableRow {
  year: number;
  capital: number;
  contributed: number;
}

function simulateScenario(
  initial: number,
  monthlyContribution: number,
  totalMonths: number,
  rAnnual: number,
  comp: Compounding,
): { final: number; yearlyEndCapital: number[] } {
  const iMonth = monthlyEquivalentRate(rAnnual, comp);
  let bal = initial;
  const yearlyEndCapital: number[] = [];

  for (let m = 1; m <= totalMonths; m++) {
    bal += monthlyContribution;
    bal *= 1 + iMonth;
    if (m % 12 === 0) {
      yearlyEndCapital.push(bal);
    }
  }

  return { final: bal, yearlyEndCapital };
}

export default function CompoundCalculator(): JSX.Element {
  const [initialStr, setInitialStr] = useState("10000");
  const [contributionStr, setContributionStr] = useState("500");
  const [contributionFrequency, setContributionFrequency] =
    useState<ContributionFrequency>("monthly");
  const [ratePctStr, setRatePctStr] = useState("7");
  const [yearsStr, setYearsStr] = useState("20");
  const [compounding, setCompounding] = useState<Compounding>("monthly");

  const parsed = useMemo(() => {
    const initial = Math.max(0, parseNum(initialStr, 0));
    const contributionAmount = parseNum(contributionStr, 0);
    const monthlyContribution = normalizeMonthlyContribution(
      contributionAmount,
      contributionFrequency,
    );
    const ratePct = parseNum(ratePctStr, 0);
    const years = Math.max(0, parseNum(yearsStr, 0));

    const rAnnual = ratePct / 100;
    const totalMonths = Math.floor(years * 12);

    const sim = simulateScenario(
      initial,
      monthlyContribution,
      totalMonths,
      rAnnual,
      compounding,
    );

    const totalContributed = initial + totalMonths * monthlyContribution;
    const finalCapital = sim.final;
    const interest = finalCapital - totalContributed;
    const multiplier =
      totalContributed !== 0 ? finalCapital / totalContributed : 0;

    const numYears = sim.yearlyEndCapital.length;

    const chartRows: YearChartRow[] = [];
    for (let yi = 0; yi < numYears; yi++) {
      const year = yi + 1;
      const contributed = initial + year * 12 * monthlyContribution;
      chartRows.push({
        year,
        capital: sim.yearlyEndCapital[yi] ?? sim.final,
        contributed,
      });
    }

    const tableRows: YearTableRow[] = chartRows.map((r) => ({
      year: r.year,
      capital: r.capital,
      contributed: r.contributed,
    }));

    return {
      initial,
      monthlyContribution,
      ratePct,
      years,
      totalMonths,
      totalContributed,
      finalCapital,
      interest,
      multiplier,
      chartRows,
      tableRows,
    };
  }, [
    initialStr,
    contributionStr,
    contributionFrequency,
    ratePctStr,
    yearsStr,
    compounding,
  ]);

  const contributionLabel =
    contributionFrequency === "weekly"
      ? "Aporte semanal (USD)"
      : "Aporte mensual (USD)";

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
        <div className="mb-4 border-b border-border pb-3 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
          Parámetros
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-left text-[13px]">
            <tbody className="divide-y divide-border">
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  Capital inicial (USD)
                </th>
                <td className="py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={initialStr}
                    onChange={(e) => setInitialStr(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  {contributionLabel}
                </th>
                <td className="py-2.5">
                  <input
                    type="number"
                    step={50}
                    value={contributionStr}
                    onChange={(e) => setContributionStr(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  Frecuencia del aporte
                </th>
                <td className="py-2.5">
                  <div
                    className="grid max-w-md grid-cols-2 gap-2"
                    role="group"
                    aria-label="Frecuencia del aporte"
                  >
                    {CONTRIBUTION_FREQUENCY_OPTIONS.map((opt) => {
                      const active = contributionFrequency === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setContributionFrequency(opt.value)}
                          className={[
                            "rounded-control border border-border-strong px-2 py-2 text-center text-[13px] font-medium leading-normal transition-colors",
                            active
                              ? "border-accent bg-accent text-white"
                              : "bg-surface-2 text-text-secondary hover:bg-surface",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  {contributionFrequency === "weekly" ? (
                    <p className="mt-1.5 text-[11px] text-text-muted">
                      El aporte semanal se convierte en un equivalente mensual
                      (52 semanas ÷ 12 meses). La simulación sigue siendo mes a
                      mes: primero el aporte equivalente, luego la
                      capitalización.
                    </p>
                  ) : null}
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  Tasa anual estimada (%)
                </th>
                <td className="py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={ratePctStr}
                    onChange={(e) => setRatePctStr(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  Capitalización
                </th>
                <td className="py-2.5">
                  <div
                    className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                    role="group"
                    aria-label="Frecuencia de capitalización"
                  >
                    {COMPOUNDING_OPTIONS.map((opt) => {
                      const active = compounding === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setCompounding(opt.value)}
                          className={[
                            "rounded-control border border-border-strong px-2 py-2 text-center text-[13px] font-medium leading-normal transition-colors",
                            active
                              ? "border-accent bg-accent text-white"
                              : "bg-surface-2 text-text-secondary hover:bg-surface",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
              <tr>
                <th className="py-2.5 pr-4 align-middle text-xs font-medium text-text-secondary">
                  Plazo (años)
                </th>
                <td className="py-2.5">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={yearsStr}
                    onChange={(e) => setYearsStr(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Capital final"
          value={formatUsd(parsed.finalCapital)}
        />
        <MetricCard
          label="Total aportado"
          value={formatUsd(parsed.totalContributed)}
          sub="Inicial + aportes (equivalente mensual)"
        />
        <MetricCard
          label="Intereses"
          value={formatUsd(parsed.interest)}
          positive={parsed.interest >= 0}
        />
        <MetricCard
          label="Multiplicador"
          value={formatMult(parsed.multiplier)}
          sub="Final ÷ total aportado"
        />
      </div>

      {parsed.tableRows.length > 0 ? (
        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
            Capital al cierre de cada año
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-[0.05em] text-metric-label">
                  <th className="py-2 pr-3">Año</th>
                  <th className="bg-accent-muted py-2 pr-3 text-accent">
                    Capital proyectado
                  </th>
                  <th className="py-2">Capital invertido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsed.tableRows.map((row) => (
                  <tr key={row.year}>
                    <td className="py-2 pr-3 font-medium text-text-primary">
                      {row.year}
                    </td>
                    <td className="bg-accent-muted py-2 pr-3 font-medium text-accent">
                      {formatUsd2(row.capital)}
                    </td>
                    <td className="py-2 text-text-secondary">
                      {formatUsd2(row.contributed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          Ingresá un plazo en años mayor a 0 para ver la tabla y el gráfico.
        </p>
      )}

      {parsed.chartRows.length > 0 ? (
        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
              Crecimiento del capital vs. total aportado
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: "var(--chart-portfolio)" }}
                />
                Capital proyectado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0 w-5 border-t-2 border-dashed border-chart-invested" />
                Total aportado
              </span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart
              key={`${parsed.ratePct}-${parsed.years}-${parsed.totalMonths}-${compounding}-${parsed.initial}-${parsed.monthlyContribution}`}
              data={parsed.chartRows}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillCapitalCompound" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--chart-portfolio)"
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--chart-portfolio)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="var(--border)"
                strokeWidth={0.5}
                vertical={false}
              />
              <XAxis
                dataKey="year"
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                tickLine={{ stroke: "var(--border)" }}
                axisLine={{ stroke: "var(--border)" }}
                label={{
                  value: "Año",
                  position: "insideBottom",
                  offset: -4,
                  fill: "var(--text-muted)",
                  fontSize: 11,
                }}
              />
              <YAxis
                tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                tickLine={{ stroke: "var(--border)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickFormatter={(v: number) =>
                  `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                }
                width={64}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) {
                    return null;
                  }
                  const row = payload[0]?.payload as YearChartRow | undefined;
                  if (!row) {
                    return null;
                  }
                  return (
                    <div
                      className="rounded-control border border-border-strong px-3 py-2 text-xs shadow-panel"
                      style={{
                        background: "var(--tooltip-bg)",
                        color: "var(--tooltip-body)",
                      }}
                    >
                      <div
                        className="mb-1.5 text-[11px] font-medium uppercase tracking-wide"
                        style={{ color: "var(--tooltip-title)" }}
                      >
                        Año {label}
                      </div>
                      <div className="space-y-1 font-mono-numeric">
                        <div>Capital: {formatUsd2(row.capital)}</div>
                        <div
                          className="border-t border-border pt-1.5"
                          style={{ borderColor: "var(--border-strong)" }}
                        >
                          Total aportado: {formatUsd2(row.contributed)}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="capital"
                name="Capital proyectado"
                stroke="var(--chart-portfolio)"
                fill="url(#fillCapitalCompound)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="contributed"
                name="Total aportado"
                stroke="var(--chart-invested)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
