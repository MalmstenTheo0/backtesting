import type { DateRangePickerProps } from "../../../types";
import {
  monthFieldShellClass,
  presetButtonBaseClass,
  presetGridClass,
  triggerClass,
} from "./styles";
import { PRESETS } from "./utils";
import { useDateRangePicker } from "./useDateRangePicker";

export default function DateRangePicker(props: DateRangePickerProps): JSX.Element {
  const {
    minDate,
    disabled,
    labelId,
    desdeId,
    hastaId,
    desdePanelId,
    hastaPanelId,
    pickerRootRef,
    startFieldShellRef,
    endFieldShellRef,
    matchedYears,
    applyPreset,
    startDisplay,
    endDisplay,
    toggleField,
    open,
    pickerPortal,
  } = useDateRangePicker(props);

  return (
    <div
      className={[
        "relative flex flex-col gap-2",
        open !== null ? "overflow-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-phase2-min={minDate ?? ""}
    >
      <span className="text-xs font-medium text-text-secondary" id={labelId}>
        Período
      </span>

      <div className={presetGridClass}>
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
                presetButtonBaseClass,
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

      <div ref={pickerRootRef} className="grid min-w-0 grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor={desdeId}>
            Desde
          </label>
          <div
            ref={startFieldShellRef}
            className={[monthFieldShellClass, disabled ? "cursor-not-allowed opacity-50" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              id={desdeId}
              type="button"
              disabled={disabled}
              aria-expanded={open === "start"}
              aria-haspopup="dialog"
              aria-controls={desdePanelId}
              className={triggerClass}
              aria-label={`Elegir mes de inicio. Actual: ${startDisplay || "sin definir"}`}
              onClick={() => {
                toggleField("start");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleField("start");
                }
              }}
            >
              {startDisplay || "—"}
            </button>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary" htmlFor={hastaId}>
            Hasta
          </label>
          <div
            ref={endFieldShellRef}
            className={[monthFieldShellClass, disabled ? "cursor-not-allowed opacity-50" : ""]
              .filter(Boolean)
              .join(" ")}
          >
            <button
              id={hastaId}
              type="button"
              disabled={disabled}
              aria-expanded={open === "end"}
              aria-haspopup="dialog"
              aria-controls={hastaPanelId}
              className={triggerClass}
              aria-label={`Elegir mes de fin. Actual: ${endDisplay || "sin definir"}`}
              onClick={() => {
                toggleField("end");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggleField("end");
                }
              }}
            >
              {endDisplay || "—"}
            </button>
          </div>
        </div>
      </div>

      {pickerPortal}
    </div>
  );
}
