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

const MONTH_3_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/** Mes con 3 letras (inicial mayúscula) + año, p. ej. `Jun 2016`, a partir de YYYY-MM o YYYY-MM-DD. */
export function formatMonthYearThreeLetters(isoDate: string): string {
  const m = isoDate.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) {
    return "";
  }
  const y = m[1];
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return "";
  }
  const raw = MONTH_3_ES[mo - 1];
  if (!raw) {
    return "";
  }
  const first = raw.charAt(0).toUpperCase();
  const abbr = `${first}${raw.slice(1)}`;
  return `${abbr} ${y}`;
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

const ISO_YEAR_MONTH = /^(\d{4})-(\d{2})/;

/** Primer día del mes (YYYY-MM-01) a partir de YYYY-MM o YYYY-MM-DD. */
export function toMonthStartIso(dateOrMonthPrefix: string): string {
  const m = dateOrMonthPrefix.trim().match(ISO_YEAR_MONTH);
  if (!m) {
    return dateOrMonthPrefix.trim();
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return dateOrMonthPrefix.trim();
  }
  return `${y}-${String(mo).padStart(2, "0")}-01`;
}

/**
 * Último día del mes a partir de YYYY-MM o YYYY-MM-DD.
 * Usa `new Date(year, month, 0)` con mes 1-based (1 = enero … 12 = diciembre).
 */
export function toMonthEndIso(dateOrMonthPrefix: string): string {
  const m = dateOrMonthPrefix.trim().match(ISO_YEAR_MONTH);
  if (!m) {
    return dateOrMonthPrefix.trim();
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return dateOrMonthPrefix.trim();
  }
  const last = new Date(y, mo, 0);
  return toIsoDateLocal(last);
}
