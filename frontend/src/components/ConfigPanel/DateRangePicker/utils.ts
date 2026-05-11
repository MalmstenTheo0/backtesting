import {
  addYearsLocal,
  toIsoDateLocal,
  toMonthEndIso,
  toMonthStartIso,
} from "../../../lib/format";
import type { DateRangePresetYears } from "../../../types";

export const MONTH_ABBR_ES = [
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

export const YEAR_FALLBACK_MIN = 1900;

export const PRESETS: { label: string; years: DateRangePresetYears }[] = [
  { label: "1A", years: 1 },
  { label: "3A", years: 3 },
  { label: "5A", years: 5 },
  { label: "10A", years: 10 },
];

export function todayIso(): string {
  return toIsoDateLocal(new Date());
}

function parseIsoLocal(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

export function isValidIsoDateString(s: string): boolean {
  const t = s.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return false;
  }
  const d = parseIsoLocal(t);
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === Number(t.slice(0, 4)) &&
    d.getMonth() + 1 === Number(t.slice(5, 7)) &&
    d.getDate() === Number(t.slice(8, 10))
  );
}

export function parseYearMonthPrefix(iso: string): { y: number; m: number } | null {
  const m = iso.trim().match(/^(\d{4})-(\d{2})/);
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) {
    return null;
  }
  return { y, m: mo };
}

export function presetRange(
  endIso: string,
  years: DateRangePresetYears,
): { start: string; end: string } {
  const end = parseIsoLocal(endIso);
  const rawStart = addYearsLocal(end, years);
  const endTrunc = toMonthEndIso(toIsoDateLocal(end));
  const startTrunc = toMonthStartIso(toIsoDateLocal(rawStart));
  return { start: startTrunc, end: endTrunc };
}

export function datesMatchPreset(
  start: string,
  end: string,
  years: DateRangePresetYears,
  capIso: string,
): boolean {
  const { start: ps, end: pe } = presetRange(capIso, years);
  return start === ps && end === pe;
}

export function buildYearRange(minY: number, maxY: number): number[] {
  if (minY > maxY) {
    return [];
  }
  const out: number[] = [];
  for (let y = minY; y <= maxY; y += 1) {
    out.push(y);
  }
  return out;
}
