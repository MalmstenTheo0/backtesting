import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import { formatMonthYearThreeLetters, toMonthEndIso, toMonthStartIso } from "../../../lib/format";
import type { DateRangePickerProps, DateRangePresetYears } from "../../../types";
import { PickerPanel } from "./PickerPanel";
import {
  PRESETS,
  buildYearRange,
  datesMatchPreset,
  isValidIsoDateString,
  parseYearMonthPrefix,
  presetRange,
  todayIso,
  YEAR_FALLBACK_MIN,
} from "./utils";

type OpenField = "start" | "end";
type PanelStep = "year" | "month";

export function useDateRangePicker({
  startDate,
  endDate,
  onChange,
  minDate,
  maxDate,
  disabled,
}: DateRangePickerProps): {
  minDate: string | undefined;
  disabled: boolean | undefined;
  labelId: string;
  desdeId: string;
  hastaId: string;
  desdePanelId: string;
  hastaPanelId: string;
  pickerRootRef: RefObject<HTMLDivElement>;
  matchedYears: DateRangePresetYears | null;
  applyPreset: (years: DateRangePresetYears) => void;
  startDisplay: string;
  endDisplay: string;
  toggleField: (field: OpenField) => void;
  open: OpenField | null;
  renderPicker: (field: OpenField) => ReactNode;
} {
  const trimmedMax = maxDate?.trim() ?? "";
  const hasExplicitMaxDate = trimmedMax.length > 0;
  const capIso = hasExplicitMaxDate ? trimmedMax : todayIso();
  const limitCapIso = hasExplicitMaxDate ? trimmedMax : todayIso();
  const calendarYear = new Date().getFullYear();
  const labelId = useId();
  const desdeId = `${labelId}-desde`;
  const hastaId = `${labelId}-hasta`;
  const desdePanelId = `${labelId}-desde-panel`;
  const hastaPanelId = `${labelId}-hasta-panel`;

  const pickerRootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState<OpenField | null>(null);
  const [step, setStep] = useState<PanelStep>("year");
  const [pickerYear, setPickerYear] = useState<number | null>(null);

  const capYm = useMemo(() => parseYearMonthPrefix(limitCapIso), [limitCapIso]);
  const minYm = useMemo(() => {
    if (!minDate || !isValidIsoDateString(minDate)) {
      return null;
    }
    return parseYearMonthPrefix(minDate);
  }, [minDate]);

  const startYm = useMemo(() => {
    if (!isValidIsoDateString(startDate)) {
      return null;
    }
    return parseYearMonthPrefix(startDate);
  }, [startDate]);

  const endYm = useMemo(() => {
    if (!isValidIsoDateString(endDate)) {
      return null;
    }
    return parseYearMonthPrefix(endDate);
  }, [endDate]);

  const globalMinYear = minYm?.y ?? YEAR_FALLBACK_MIN;
  const globalMaxYear = hasExplicitMaxDate
    ? parseYearMonthPrefix(trimmedMax)?.y ?? calendarYear
    : calendarYear;

  const yearRangeForField = useMemo(() => {
    if (open === "start") {
      const minY = globalMinYear;
      const maxY = endYm ? Math.min(globalMaxYear, endYm.y) : globalMaxYear;
      return buildYearRange(minY, maxY);
    }
    if (open === "end") {
      const minY = startYm ? Math.max(globalMinYear, startYm.y) : globalMinYear;
      const maxY = Math.max(globalMaxYear, endYm?.y ?? globalMinYear);
      return buildYearRange(minY, maxY);
    }
    return [];
  }, [open, globalMinYear, globalMaxYear, startYm, endYm]);

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
      const nextStart = toMonthStartIso(raw);
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
      const nextEnd = toMonthEndIso(raw);
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

  const closePanel = useCallback(() => {
    setOpen(null);
    setStep("year");
    setPickerYear(null);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const root = pickerRootRef.current;
      if (!root || !(e.target instanceof Node) || root.contains(e.target)) {
        return;
      }
      closePanel();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, closePanel]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closePanel]);

  const toggleField = useCallback(
    (field: OpenField) => {
      if (disabled) {
        return;
      }
      setOpen((prev) => (prev === field ? null : field));
      setStep("year");
      setPickerYear(null);
    },
    [disabled],
  );

  const isMonthDisabled = useCallback(
    (month1: number): boolean => {
      if (!open || !pickerYear) {
        return true;
      }

      const cal = new Date();
      const currentCalendarYear = cal.getFullYear();
      const currentCalendarMonth1 = cal.getMonth() + 1;

      if (pickerYear === currentCalendarYear && month1 > currentCalendarMonth1) {
        return true;
      }

      if (minYm && pickerYear === minYm.y && month1 < minYm.m) {
        return true;
      }

      if (capYm && pickerYear === capYm.y && month1 > capYm.m) {
        return true;
      }

      if (open === "start" && endYm && pickerYear === endYm.y && month1 > endYm.m) {
        return true;
      }

      if (open === "end" && startYm && pickerYear === startYm.y && month1 < startYm.m) {
        return true;
      }

      return false;
    },
    [open, pickerYear, minYm, capYm, endYm, startYm],
  );

  const onPickYear = useCallback((y: number) => {
    setPickerYear(y);
    setStep("month");
  }, []);

  const onBackToYearStep = useCallback(() => {
    setStep("year");
    setPickerYear(null);
  }, []);

  const onPickMonth = useCallback(
    (month1: number) => {
      if (!open || !pickerYear || isMonthDisabled(month1)) {
        return;
      }
      const raw = `${pickerYear}-${String(month1).padStart(2, "0")}`;
      if (open === "start") {
        onStartMonthChange(raw);
      } else {
        onEndMonthChange(raw);
      }
      closePanel();
    },
    [
      open,
      pickerYear,
      isMonthDisabled,
      onStartMonthChange,
      onEndMonthChange,
      closePanel,
    ],
  );

  const renderPicker = useCallback(
    (field: OpenField) => {
      if (open !== field) {
        return null;
      }
      const selectedValueYear =
        field === "start" ? startYm?.y ?? null : endYm?.y ?? null;
      return (
        <PickerPanel
          field={field}
          panelId={field === "start" ? desdePanelId : hastaPanelId}
          step={step}
          pickerYear={pickerYear}
          yearRange={yearRangeForField}
          selectedValueYear={selectedValueYear}
          startYm={startYm}
          endYm={endYm}
          onPickYear={onPickYear}
          onBackToYearStep={onBackToYearStep}
          isMonthDisabled={isMonthDisabled}
          onPickMonth={onPickMonth}
        />
      );
    },
    [
      open,
      desdePanelId,
      hastaPanelId,
      step,
      pickerYear,
      yearRangeForField,
      startYm,
      endYm,
      onPickYear,
      onBackToYearStep,
      isMonthDisabled,
      onPickMonth,
    ],
  );

  return {
    minDate,
    disabled,
    labelId,
    desdeId,
    hastaId,
    desdePanelId,
    hastaPanelId,
    pickerRootRef,
    matchedYears,
    applyPreset,
    startDisplay,
    endDisplay,
    toggleField,
    open,
    renderPicker,
  };
}
