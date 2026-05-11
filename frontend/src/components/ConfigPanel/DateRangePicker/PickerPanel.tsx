import { MONTH_ABBR_ES } from "./utils";
import {
  cellActiveClass,
  cellDisabledClass,
  cellIdleClass,
  monthStepBackButtonClass,
  monthStepHeaderClass,
  pickerPanelSurfaceClass,
  pickMonthCellClass,
  pickMonthGridClass,
  pickYearCellClass,
  pickYearGridClass,
  yearScrollClass,
} from "./styles";

export type PickerField = "start" | "end";
export type PickerStep = "year" | "month";

export interface PickerPanelProps {
  field: PickerField;
  panelId: string;
  step: PickerStep;
  pickerYear: number | null;
  yearRange: number[];
  selectedValueYear: number | null;
  startYm: { y: number; m: number } | null;
  endYm: { y: number; m: number } | null;
  onPickYear: (y: number) => void;
  onBackToYearStep: () => void;
  isMonthDisabled: (month1: number) => boolean;
  onPickMonth: (month1: number) => void;
}

export function PickerPanel({
  field,
  panelId,
  step,
  pickerYear,
  yearRange,
  selectedValueYear,
  startYm,
  endYm,
  onPickYear,
  onBackToYearStep,
  isMonthDisabled,
  onPickMonth,
}: PickerPanelProps): JSX.Element {
  const ariaLabel =
    field === "start" ? "Elegir mes de inicio" : "Elegir mes de fin";

  return (
    <div id={panelId} role="dialog" aria-label={ariaLabel} className={pickerPanelSurfaceClass}>
      {step === "year" ? (
        <div className={yearScrollClass}>
          <div className={pickYearGridClass}>
            {yearRange.map((y) => {
              const active = selectedValueYear === y;
              return (
                <button
                  key={y}
                  type="button"
                  className={[
                    pickYearCellClass,
                    active ? cellActiveClass : cellIdleClass,
                  ].join(" ")}
                  onClick={() => {
                    onPickYear(y);
                  }}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex w-full min-w-0 flex-col gap-2">
          <div className={monthStepHeaderClass}>
            <button
              type="button"
              className={monthStepBackButtonClass}
              aria-label="Volver a elegir año"
              onClick={onBackToYearStep}
            >
              <span aria-hidden className="text-sm leading-none">
                ←
              </span>
            </button>
            <span className="min-w-0 flex-1 text-center text-[13px] font-medium text-text-primary">
              {pickerYear}
            </span>
          </div>
          <div className={pickMonthGridClass}>
            {MONTH_ABBR_ES.map((abbr, idx) => {
              const month1 = idx + 1;
              const off = isMonthDisabled(month1);
              const selected =
                pickerYear !== null &&
                selectedValueYear === pickerYear &&
                (field === "start" ? startYm?.m === month1 : endYm?.m === month1);
              return (
                <button
                  key={abbr}
                  type="button"
                  disabled={off}
                  className={[
                    pickMonthCellClass,
                    off ? cellDisabledClass : selected ? cellActiveClass : cellIdleClass,
                  ].join(" ")}
                  onClick={() => {
                    onPickMonth(month1);
                  }}
                >
                  {abbr}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
