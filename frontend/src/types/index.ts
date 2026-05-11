/** Años atrás desde `maxDate` para presets del selector de rango. */
export type DateRangePresetYears = 1 | 3 | 5 | 10;

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  /** Fase 2: límite inferior permitido (YYYY-MM-DD). */
  minDate?: string;
  /** Fase 2: límite superior; por defecto hoy (YYYY-MM-DD). */
  maxDate?: string;
  disabled?: boolean;
  /** Notifica si el panel flotante (año/mes) está abierto; útil para `overflow`/`z-index` en ancestros. */
  onPickerOpenChange?: (open: boolean) => void;
}

export type AssetType = "crypto" | "etf" | "stock";

export type Frequency = "daily" | "weekly" | "monthly";

export type StrategyName = "dca" | "dca_weighted" | "value_averaging";

export interface AssetItem {
  ticker: string;
  name: string;
  type: AssetType;
  data_since: string;
  /** Fecha mínima de datos históricos para la UI (YYYY-MM-DD); opcional, viene de constantes curadas por ticker. */
  dataFrom?: string;
}

export interface AssetsResponse {
  assets: AssetItem[];
}

export interface BacktestRequest {
  ticker: string;
  amount_per_period: number;
  frequency: Frequency;
  start_date: string;
  end_date: string;
  commission_pct?: number;
  strategy?: StrategyName;
}

export interface BacktestSummary {
  ticker: string;
  strategy: string;
  frequency: string;
  start_date: string;
  end_date: string;
  total_periods: number;
  amount_per_period: number;
  commission_pct: number;
}

export interface BacktestMetrics {
  total_invested: number;
  total_commissions_paid: number;
  final_value: number;
  absolute_return: number;
  return_pct: number;
  cagr_pct: number;
  total_units: number;
}

export interface LumpSumMetrics {
  capital: number;
  units_bought: number;
  final_value: number;
  return_pct: number;
  cagr_pct: number;
}

export interface ChartPoint {
  date: string;
  price: number;
  invested: number;
  portfolio_value: number;
  is_buy: boolean;
}

export interface BacktestResponse {
  summary: BacktestSummary;
  metrics: BacktestMetrics;
  lump_sum: LumpSumMetrics;
  chart_data: ChartPoint[];
}

export interface HealthResponse {
  status: string;
}
