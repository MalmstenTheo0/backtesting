import { useCallback, useId, useMemo, useRef } from "react";
import {
  addYearsLocal,
  formatMonthYearThreeLetters,
  toIsoDateLocal,
  toMonthEndIso,
  toMonthStartIso,
} from "../../lib/format";
import type {
  DateRangePickerProps,
  DateRangePresetYears,
} from "../../types";

function todayIso(): string {
  return toIsoDateLocal(new Date());
}

function parseIsoLocal(iso: string): Date {
  return new Date(`${iso}T12:00:00`);
}

function isValidIsoDateString(s: string): boolean {
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

function toMonthInputValue(isoYmd: string): string {
  const t = isoYmd.trim();
  if (/^\d{4}-\d{2}$/.test(t)) {
    return t;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    return t.slice(0, 7);
  }
  return "";
}

function presetRange(
  endIso: string,
  years: DateRangePresetYears,
): { start: string; end: string } {
  const end = parseIsoLocal(endIso);
  const rawStart = addYearsLocal(end, years);
  const endTrunc = toMonthEndIso(toIsoDateLocal(end));
  const startTrunc = toMonthStartIso(toIsoDateLocal(rawStart));
  return { start: startTrunc, end: endTrunc };
}

function datesMatchPreset(
  start: string,
  end: string,
  years: DateRangePresetYears,
  capIso: string,
): boolean {
  const { start: ps, end: pe } = presetRange(capIso, years);
  return start === ps && end === pe;
}

const PRESETS: { label: string; years: DateRangePresetYears }[] = [
  { label: "1A", years: 1 },
  { label: "3A", years: 3 },
  { label: "5A", years: 5 },
  { label: "10A", years: 10 },
];

const monthFieldShellClass =
  "relative h-9 w-full rounded-control border border-border-strong bg-surface-2 transition-colors hover:border-accent/50 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-[var(--focus-ring)]";
const monthFieldDisplayClass =
  "pointer-events-none relative z-[1] flex h-9 w-full items-center px-2.5 font-sans text-[13px] font-normal leading-normal text-text-primary";

/** Input casi invisible: `sr-only` suele hacer que `showPicker()` falle en Chromium. */
const monthFieldNativeHiddenClass =
  "pointer-events-none absolute inset-0 z-0 h-full w-full opacity-[0.01] disabled:cursor-not-allowed";

const monthFieldOpenButtonClass =
  "absolute inset-0 z-[2] cursor-pointer bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed";
function tryOpenMonthPicker(input: HTMLInputElement | null): void {
  if (!input || input.disabled) {
    return;
  }
  try {
    if (typeof input.showPicker === "function") {
      void input.showPicker();
      return;
    }
  } catch {
    // Sin permiso o no soportado: seguir con focus + click
  }
  input.focus();
  try {
    input.click();
  } catch {
    // ignorar
  }
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  disabled,
}: DateRangePickerProps): JSX.Element {
  const capIso = maxDate ?? todayIso();
  const labelId = useId();
  const desdeId = `${labelId}-desde`;
  const hastaId = `${labelId}-hasta`;

  const minMonth = minDate ? toMonthInputValue(minDate) : undefined;
  const maxMonth = maxDate ? toMonthInputValue(maxDate) : toMonthInputValue(capIso);

  const startMonthValue = useMemo(
    () => toMonthInputValue(startDate),
    [startDate],
  );
  const endMonthValue = useMemo(() => toMonthInputValue(endDate), [endDate]);

  const matchedYears = useMemo(() => {
    for (const p of PRESETS) {
      if (datesMatchPreset(startDate, endDate, p.years, capIso)) {
        return p.years;
      }
    }
    return null;
  }, [startDate, endDate, capIso]);

  const applyPreset = useCallback(
    (years: DateRangePresetYears) => {
      const { start, end } = presetRange(capIso, years);
      onChange(start, end);
    },
    [onChange, capIso],
  );

  const onStartMonthChange = useCallback(
    (raw: string) => {
      if (!raw) {
        return;
      }
      let nextStart = toMonthStartIso(raw);
      let nextEnd = endDate;
      if (nextStart > nextEnd) {
        nextEnd = toMonthEndIso(raw);
      }
      onChange(nextStart, nextEnd);
    },
    [endDate, onChange],
  );

  const onEndMonthChange = useCallback(
    (raw: string) => {
      if (!raw) {
        return;
      }
      let nextEnd = toMonthEndIso(raw);
      let nextStart = startDate;
      if (nextEnd < nextStart) {
        nextStart = toMonthStartIso(raw);
      }
      onChange(nextStart, nextEnd);
    },
    [startDate, onChange],
  );

  const startDisplay = useMemo(() => {
    if (!isValidIsoDateString(startDate)) {
      return "";
    }
    return formatMonthYearThreeLetters(startDate);
  }, [startDate]);

  const endDisplay = useMemo(() => {
    if (!isValidIsoDateString(endDate)) {
      return "";
    }
    return formatMonthYearThreeLetters(endDate);
  }, [endDate]);

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex flex-col gap-2" data-phase2-min={minDate ?? ""}>
      <span className="text-xs font-medium text-text-secondary" id={labelId}>
        Período
      </span>

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map((p) => {
          const active = matchedYears === p.years;
          return (
            <button
              key={p.years}
              type="button"
              disabled={disabled}
              onClick={() => {
                applyPreset(p.years);
              }}
              className={[
                "rounded-control border py-1.5 text-center font-sans text-[13px] font-medium leading-normal transition-colors",
                active
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border-strong bg-surface-2 text-text-secondary hover:border-accent/50",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor={desdeId}>
            Desde
          </label>
          <div
            className={[
              monthFieldShellClass,
              disabled ? "cursor-not-allowed opacity-50" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              ref={startInputRef}
              type="month"
              tabIndex={-1}
              disabled={disabled}
              min={minMonth}
              max={endMonthValue || maxMonth}
              value={isValidIsoDateString(startDate) ? startMonthValue : ""}
              onChange={(e) => {
                onStartMonthChange(e.target.value);
              }}
              className={monthFieldNativeHiddenClass}
              aria-hidden
            />
            <div className={monthFieldDisplayClass} aria-hidden>
              {startDisplay || "—"}
            </div>
            <button
              id={desdeId}
              type="button"
              disabled={disabled}
              className={monthFieldOpenButtonClass}
              aria-label={`Elegir mes de inicio. Actual: ${startDisplay || "sin definir"}`}
              onClick={() => {
                tryOpenMonthPicker(startInputRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tryOpenMonthPicker(startInputRef.current);
                }
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor={hastaId}>
            Hasta
          </label>
          <div
            className={[
              monthFieldShellClass,
              disabled ? "cursor-not-allowed opacity-50" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <input
              ref={endInputRef}
              type="month"
              tabIndex={-1}
              disabled={disabled}
              min={startMonthValue || minMonth}
              max={maxMonth}
              value={isValidIsoDateString(endDate) ? endMonthValue : ""}
              onChange={(e) => {
                onEndMonthChange(e.target.value);
              }}
              className={monthFieldNativeHiddenClass}
              aria-hidden
            />
            <div className={monthFieldDisplayClass} aria-hidden>
              {endDisplay || "—"}
            </div>
            <button
              id={hastaId}
              type="button"
              disabled={disabled}
              className={monthFieldOpenButtonClass}
              aria-label={`Elegir mes de fin. Actual: ${endDisplay || "sin definir"}`}
              onClick={() => {
                tryOpenMonthPicker(endInputRef.current);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  tryOpenMonthPicker(endInputRef.current);
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
