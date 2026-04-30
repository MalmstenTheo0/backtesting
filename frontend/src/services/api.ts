import type {
  AssetsResponse,
  BacktestRequest,
  BacktestResponse,
  HealthResponse,
} from "../types";

const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Serializa `detail` de respuestas FastAPI (string, lista de errores, u otros). */
export function formatApiError(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        "msg" in item &&
        typeof (item as { msg: unknown }).msg === "string"
      ) {
        const loc = (item as { loc?: unknown }).loc;
        const locStr = Array.isArray(loc)
          ? loc.filter((x) => typeof x === "string").join(".")
          : "";
        const msg = (item as { msg: string }).msg;
        return locStr ? `${locStr}: ${msg}` : msg;
      }
      if (typeof item === "string") {
        return item;
      }
      return JSON.stringify(item);
    });
    return parts.filter(Boolean).join(" · ");
  }
  if (typeof detail === "object" && detail !== null) {
    return JSON.stringify(detail);
  }
  return String(detail);
}

async function parseJsonError(res: Response): Promise<string> {
  try {
    const error: unknown = await res.json();
    if (typeof error === "object" && error !== null && "detail" in error) {
      return formatApiError((error as { detail: unknown }).detail);
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
