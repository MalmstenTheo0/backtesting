export type AssetType = "crypto" | "etf" | "stock";

export type Frequency = "daily" | "weekly" | "monthly";

export type StrategyName = "dca" | "dca_weighted" | "value_averaging";

export interface AssetItem {
  ticker: string;
  name: string;
  type: AssetType;
  data_since: string;
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
