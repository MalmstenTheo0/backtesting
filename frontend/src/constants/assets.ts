import type { AssetItem } from "../types";

/** Lista estática vacía: la UI usa `GET /api/v1/assets` como fuente de verdad. */
export const CURATED_ASSETS: AssetItem[] = [];

/** Mínimo histórico permitido en el selector por ticker (YYYY-MM-DD). */
export const ASSET_DATA_FROM_ENTRIES: { ticker: string; dataFrom: string }[] = [
  { ticker: "BTC-USD", dataFrom: "2017-08-01" },
  { ticker: "ETH-USD", dataFrom: "2017-08-01" },
  { ticker: "SOL-USD", dataFrom: "2020-08-01" },
  { ticker: "SPY", dataFrom: "1999-11-01" },
  { ticker: "QQQ", dataFrom: "1999-11-01" },
  { ticker: "VTI", dataFrom: "2001-06-01" },
];

export const ASSET_DATA_FROM_BY_TICKER: Record<string, string> = Object.fromEntries(
  ASSET_DATA_FROM_ENTRIES.map((e) => [e.ticker, e.dataFrom]),
);
