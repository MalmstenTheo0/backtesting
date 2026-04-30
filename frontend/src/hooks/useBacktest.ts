import { useCallback, useState } from "react";

import type { BacktestRequest, BacktestResponse } from "../types";
import { runBacktest } from "../services/api";

export interface UseBacktestState {
  data: BacktestResponse | null;
  loading: boolean;
  error: string | null;
}

export function useBacktest(): UseBacktestState & {
  execute: (params: BacktestRequest) => Promise<void>;
  reset: () => void;
} {
  const [data, setData] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (params: BacktestRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await runBacktest(params);
      setData(result);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
