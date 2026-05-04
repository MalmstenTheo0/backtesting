import { useCallback, useMemo } from "react";

import { addYearsLocal, toIsoDateLocal } from "../../lib/format";

export type PresetYears = 1 | 3 | 5 | 10;

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  disabled?: boolean;
}

function todayIso(): string {
  return toIsoDateLocal(new Date());
}

function presetRange(years: PresetYears): { start: string; end: string } {
  const end = new Date();
  const start = addYearsLocal(end, years);
  return { start: toIsoDateLocal(start), end: toIsoDateLocal(end) };
}

function datesMatchPreset(
  start: string,
  end: string,
  years: PresetYears,
): boolean {
  const { start: ps, end: pe } = presetRange(years);
  return start === ps && end === pe;
}

const PRESETS: { label: string; years: PresetYears }[] = [
  { label: "1A", years: 1 },
  { label: "3A", years: 3 },
  { label: "5A", years: 5 },
  { label: "10A", years: 10 },
];

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  disabled,
}: DateRangePickerProps): JSX.Element {
  const matchedYears = useMemo(() => {
    for (const p of PRESETS) {
      if (datesMatchPreset(startDate, endDate, p.years)) {
        return p.years;
      }
    }
    return null;
  }, [startDate, endDate]);

  const applyPreset = useCallback(
    (years: PresetYears) => {
      const { start, end } = presetRange(years);
      onChange(start, end);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-secondary">Período</span>
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
          <label className="text-xs font-medium text-text-secondary">
            Desde
          </label>
          <input
            type="date"
            disabled={disabled}
            value={startDate}
            max={endDate}
            onChange={(e) => {
              onChange(e.target.value, endDate);
            }}
            className="h-9 w-full rounded-control border border-border-strong bg-surface-2 px-2.5 font-sans text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Hasta
          </label>
          <input
            type="date"
            disabled={disabled}
            value={endDate}
            min={startDate}
            max={todayIso()}
            onChange={(e) => {
              onChange(startDate, e.target.value);
            }}
            className="h-9 w-full rounded-control border border-border-strong bg-surface-2 px-2.5 font-sans text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]"
          />
        </div>
      </div>
    </div>
  );
}
