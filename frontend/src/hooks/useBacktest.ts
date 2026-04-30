import { useCallback, useRef, useState } from "react";

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
  const requestSeq = useRef(0);

  const execute = useCallback(async (params: BacktestRequest) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await runBacktest(params);
      if (seq !== requestSeq.current) {
        return;
      }
      setData(result);
    } catch (e) {
      if (seq !== requestSeq.current) {
        return;
      }
      setData(null);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    requestSeq.current += 1;
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
