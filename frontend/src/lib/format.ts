const moneyFmt = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const moneyFmtDecimals = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(value: number, decimals = false): string {
  return decimals ? moneyFmtDecimals.format(value) : moneyFmt.format(value);
}

/** Retornos de la API ya vienen en puntos porcentuales (p. ej. 49.3 → +49,30%). */
export function formatMetricPercent(value: number, digits = 2): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatPercentPlain(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

const monthFmt = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  year: "numeric",
});

export function formatMonthYear(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return monthFmt.format(d);
}

export function toIsoDateLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addYearsLocal(from: Date, years: number): Date {
  const out = new Date(from);
  out.setFullYear(out.getFullYear() - years);
  return out;
}
