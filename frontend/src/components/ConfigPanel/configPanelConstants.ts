import type { Frequency } from "../../types";

export const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

export const ETF_DAILY_DISABLED_TITLE =
  "No disponible para ETFs en plan gratuito";
