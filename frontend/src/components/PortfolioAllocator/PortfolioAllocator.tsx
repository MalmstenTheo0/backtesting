import { useCallback, useId, useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const INPUT_CLASS =
  "h-9 w-full min-w-0 rounded-control border border-border-strong bg-surface-2 px-2.5 text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]";

const SLICE_COLORS = [
  "var(--chart-portfolio)",
  "var(--chart-price)",
  "#22c55e",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
];

const UNASSIGNED_FILL = "var(--chart-invested)";

let rowIdSeq = 0;
function newRowId(): string {
  rowIdSeq += 1;
  return `asset-${rowIdSeq}`;
}

interface AssetRow {
  id: string;
  symbol: string;
  pctStr: string;
}

function parsePct(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") {
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

function parseMoney(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (t === "") {
    return null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) {
    return null;
  }
  return n;
}

export default function PortfolioAllocator(): JSX.Element {
  const formId = useId();
  const [totalStr, setTotalStr] = useState("");
  const [rows, setRows] = useState<AssetRow[]>(() => [
    { id: newRowId(), symbol: "", pctStr: "" },
    { id: newRowId(), symbol: "", pctStr: "" },
  ]);

  const analysis = useMemo(() => {
    let sumValid = 0;
    const validAssets: { symbol: string; pct: number }[] = [];

    let hasEmptySymbolWithPct = false;
    let hasSymbolNeedingPct = false;
    let hasPctTooSmall = false;
    let hasPctOver100 = false;

    for (const row of rows) {
      const sym = row.symbol.trim();
      const pct = parsePct(row.pctStr);

      if (sym === "") {
        if (pct !== null && pct !== 0) {
          hasEmptySymbolWithPct = true;
        }
        continue;
      }

      if (pct === null || pct <= 0) {
        hasSymbolNeedingPct = true;
        continue;
      }

      if (pct > 100) {
        hasPctOver100 = true;
        continue;
      }

      if (pct < 0.01) {
        hasPctTooSmall = true;
        continue;
      }

      sumValid += pct;
      validAssets.push({ symbol: sym.toUpperCase(), pct });
    }

    const over = sumValid > 100 + 1e-6;
    const unassigned = Math.max(0, 100 - sumValid);

    const totalRaw = parseMoney(totalStr);
    const total =
      totalRaw === null ? null : Math.max(0, totalRaw);

    const pieSlices: { name: string; value: number; fill?: string }[] = [];
    if (!over) {
      validAssets.forEach((a, idx) => {
        pieSlices.push({
          name: a.symbol,
          value: a.pct,
          fill: SLICE_COLORS[idx % SLICE_COLORS.length],
        });
      });
      if (unassigned > 0.0001 && sumValid <= 100 && validAssets.length > 0) {
        pieSlices.push({
          name: "Sin asignar",
          value: unassigned,
          fill: UNASSIGNED_FILL,
        });
      }
    }

    const showDistributionTable =
      total !== null &&
      total > 0 &&
      validAssets.length >= 2 &&
      !over;

    return {
      sumValid,
      unassigned,
      over,
      validAssets,
      pieSlices,
      hasEmptySymbolWithPct,
      hasSymbolNeedingPct,
      hasPctTooSmall,
      hasPctOver100,
      total,
      showDistributionTable,
    };
  }, [rows, totalStr]);

  const usdFmt = useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const updateRow = useCallback(
    (id: string, patch: Partial<Pick<AssetRow, "symbol" | "pctStr">>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, { id: newRowId(), symbol: "", pctStr: "" }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 2) {
        return prev;
      }
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const messages: { type: "error" | "warn" | "ok"; text: string }[] = [];
  if (analysis.hasEmptySymbolWithPct) {
    messages.push({
      type: "error",
      text: "Cada fila con porcentaje necesita un símbolo (no dejes el ticker vacío).",
    });
  }
  if (analysis.hasSymbolNeedingPct) {
    messages.push({
      type: "error",
      text: "Indicá un % mayor a 0 (mínimo 0,01%) para cada símbolo con monto asignado.",
    });
  }
  if (analysis.hasPctTooSmall) {
    messages.push({
      type: "error",
      text: "El mínimo por activo es 0,01%.",
    });
  }
  if (analysis.hasPctOver100) {
    messages.push({
      type: "error",
      text: "Ningún activo puede superar el 100% en una sola fila.",
    });
  }
  if (analysis.over) {
    messages.push({
      type: "error",
      text: `La suma de porcentajes (${analysis.sumValid.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%) supera el 100%.`,
    });
  }
  if (
    !analysis.over &&
    analysis.sumValid > 0 &&
    analysis.sumValid < 99.999
  ) {
    messages.push({
      type: "warn",
      text: `Quedan ${analysis.unassigned.toLocaleString("es-AR", { maximumFractionDigits: 2 })}% sin asignar.`,
    });
  }
  if (!analysis.over && analysis.sumValid >= 99.999 && analysis.sumValid <= 100.0001 && analysis.validAssets.length > 0) {
    messages.push({
      type: "ok",
      text: "Asignación completa: 100% distribuido.",
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
        <div className="mb-4 border-b border-border pb-3 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
          Monto total
        </div>
        <label className="flex flex-col gap-1.5" htmlFor={`${formId}-total`}>
          <span className="text-xs font-medium text-text-secondary">
            Total en USD (para ver montos en la tabla)
          </span>
          <input
            id={`${formId}-total`}
            type="number"
            min={0}
            step={100}
            placeholder="Ej. 10000"
            value={totalStr}
            onChange={(e) => setTotalStr(e.target.value)}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
            Activos
          </div>
          <button
            type="button"
            onClick={addRow}
            className="rounded-control border border-border-strong bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            Agregar activo
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] font-medium uppercase tracking-[0.05em] text-metric-label">
                <th className="py-2 pr-2">Símbolo</th>
                <th className="py-2 pr-2">% cartera</th>
                <th className="w-10 py-2" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Símbolo fila ${row.id}`}
                      type="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="VTI"
                      value={row.symbol}
                      onChange={(e) =>
                        updateRow(row.id, {
                          symbol: e.target.value.toUpperCase(),
                        })
                      }
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="py-2 pr-2">
                    <input
                      aria-label={`Porcentaje fila ${row.id}`}
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      placeholder="0"
                      value={row.pctStr}
                      onChange={(e) =>
                        updateRow(row.id, { pctStr: e.target.value })
                      }
                      className={INPUT_CLASS}
                    />
                  </td>
                  <td className="py-2 text-right">
                    {rows.length > 2 ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-text-muted underline-offset-2 hover:text-accent hover:underline"
                        onClick={() => removeRow(row.id)}
                      >
                        Quitar
                      </button>
                    ) : (
                      <span className="text-[11px] text-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {messages.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {messages.map((m, idx) => (
              <li
                key={`${idx}-${m.type}`}
                className={[
                  "rounded-control border px-2.5 py-2 text-xs",
                  m.type === "error"
                    ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                    : m.type === "warn"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                      : "border-positive/40 bg-positive-bg text-positive",
                ].join(" ")}
              >
                {m.text}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
            Distribución (%)
          </div>
          {analysis.pieSlices.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={analysis.pieSlices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={96}
                  paddingAngle={1}
                  labelLine={false}
                  label={({ name, value }) =>
                    `${String(name)} ${Number(value).toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
                  }
                >
                  {analysis.pieSlices.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}-${index}`}
                      fill={entry.fill ?? SLICE_COLORS[index % SLICE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-text-muted">
              {analysis.over
                ? "La suma supera el 100%: corregí los porcentajes para ver el gráfico."
                : "Completá símbolo y % en al menos un activo para ver el gráfico."}
            </p>
          )}
          <p className="mt-2 text-[11px] text-text-muted">
            Leyenda: cada etiqueta muestra símbolo y % asignado. El sector gris
            es lo no asignado si la suma es menor a 100%.
          </p>
        </div>

        <div className="rounded-panel border border-border bg-surface p-5 shadow-panel">
          <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
            Montos en USD
          </div>
          {!analysis.showDistributionTable ? (
            <p className="text-sm text-text-secondary">
              {analysis.total === null || analysis.total <= 0
                ? "Ingresá un monto total en USD mayor a 0."
                : analysis.validAssets.length < 2
                  ? "Necesitás al menos 2 activos válidos (símbolo + % entre 0,01 y 100) y que la suma no supere 100%."
                  : analysis.over
                    ? "Corregí los porcentajes para que la suma no supere 100%."
                    : null}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] font-medium uppercase tracking-[0.05em] text-metric-label">
                    <th className="py-2 pr-3">Símbolo</th>
                    <th className="py-2 pr-3">%</th>
                    <th className="py-2">USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {analysis.validAssets.map((a) => (
                    <tr key={a.symbol}>
                      <td className="py-2 pr-3 font-medium text-text-primary">
                        {a.symbol}
                      </td>
                      <td className="py-2 pr-3 text-text-secondary">
                        {a.pct.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        %
                      </td>
                      <td className="py-2 font-mono-numeric text-text-primary">
                        {usdFmt.format(
                          (analysis.total ?? 0) * (a.pct / 100),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
