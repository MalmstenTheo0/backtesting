import type { Frequency } from "../../types";

const OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

export interface FrequencySelectorProps {
  value: Frequency;
  onChange: (value: Frequency) => void;
  disabled?: boolean;
}

export function FrequencySelector({
  value,
  onChange,
  disabled,
}: FrequencySelectorProps): JSX.Element {
  return (
    <div
      className="grid grid-cols-3 overflow-hidden rounded-control border border-border-strong"
      role="group"
      aria-label="Frecuencia"
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => {
              onChange(opt.value);
            }}
            className={[
              "border-r border-border-strong py-2 px-1 text-center font-sans text-xs font-medium transition-colors last:border-r-0",
              active
                ? "bg-accent text-white"
                : "bg-surface-2 text-text-secondary hover:bg-surface",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
