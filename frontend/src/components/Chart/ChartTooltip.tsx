import type { TooltipProps } from "recharts";

type ChartRow = {
  date: string;
  price: number;
  invested: number;
  portfolio_value: number;
  is_buy: boolean;
};

export type BacktestTooltipProps = TooltipProps<number, string> & {
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    value?: number;
    color?: string;
    payload?: ChartRow;
  }>;
};

/** Tooltip de Recharts: fondo oscuro en ambos temas (variables CSS). */
export function ChartTooltip({
  active,
  label,
  payload,
}: BacktestTooltipProps): JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }

  const dateLabel =
    typeof label === "string" && label
      ? label
      : (payload[0]?.payload?.date as string | undefined) ?? "";

  const rows = payload.filter(
    (p) =>
      p.dataKey !== undefined &&
      p.value !== undefined &&
      typeof p.value === "number",
  );

  return (
    <div
      className="rounded-md px-2.5 py-2.5 shadow-lg"
      style={{
        background: "var(--tooltip-bg)",
        color: "var(--tooltip-body)",
      }}
    >
      <div
        className="mb-1 font-sans text-[11px]"
        style={{ color: "var(--tooltip-title)" }}
      >
        {dateLabel}
      </div>
      <ul className="flex flex-col gap-1 font-mono text-xs">
        {rows.map((p) => (
          <li key={String(p.dataKey)} className="flex gap-2">
            <span style={{ color: "var(--tooltip-title)" }}>
              {labelForKey(String(p.dataKey))}:
            </span>
            <span>{formatVal(String(p.dataKey), p.value as number)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function labelForKey(dataKey: string): string {
  switch (dataKey) {
    case "portfolio_value":
      return "Portfolio";
    case "invested":
      return "Invertido";
    case "price":
      return "Precio";
    default:
      return dataKey;
  }
}

function formatVal(dataKey: string, v: number): string {
  if (dataKey === "price") {
    return v.toLocaleString("es-AR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    });
  }
  return v.toLocaleString("es-AR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
