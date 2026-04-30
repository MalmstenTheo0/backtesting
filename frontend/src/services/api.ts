import type {
  AssetsResponse,
  BacktestRequest,
  BacktestResponse,
  HealthResponse,
} from "../types";

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function parseJsonError(res: Response): Promise<string> {
  try {
    const error: unknown = await res.json();
    if (
      typeof error === "object" &&
      error !== null &&
      "detail" in error &&
      typeof (error as { detail: unknown }).detail === "string"
    ) {
      return (error as { detail: string }).detail;
    }
  } catch {
    /* ignore */
  }
  return res.statusText;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return res.json() as Promise<HealthResponse>;
}

export async function fetchAssets(): Promise<AssetsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/assets`);
  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }
  return res.json() as Promise<AssetsResponse>;
}

export async function runBacktest(
  params: BacktestRequest,
): Promise<BacktestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error(await parseJsonError(res));
  }

  return res.json() as Promise<BacktestResponse>;
}
