import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runBacktest } from "../services/api";
import type { BacktestRequest, BacktestResponse } from "../types";
import { useBacktest } from "./useBacktest";

vi.mock("../services/api", () => ({ runBacktest: vi.fn() }));

const runBacktestMock = vi.mocked(runBacktest);

function respuesta(ticker: string): BacktestResponse {
  return {
    summary: {
      ticker,
      strategy: "dca",
      frequency: "monthly",
      start_date: "2020-01-01",
      end_date: "2024-01-31",
      total_periods: 12,
      amount_per_period: 100,
      commission_pct: 0,
    },
    metrics: {
      total_invested: 1200,
      total_commissions_paid: 0,
      final_value: 1500,
      absolute_return: 300,
      return_pct: 25,
      cagr_pct: 6,
      total_units: 1.5,
    },
    lump_sum: {
      capital: 1200,
      units_bought: 1.2,
      final_value: 1600,
      return_pct: 33.33,
      cagr_pct: 7,
    },
    chart_data: [],
  };
}

const params: BacktestRequest = {
  ticker: "BTC-USD",
  amount_per_period: 100,
  frequency: "monthly",
  start_date: "2020-01-01",
  end_date: "2024-01-31",
};

beforeEach(() => {
  runBacktestMock.mockReset();
});

describe("useBacktest", () => {
  it("arranca vacío", () => {
    const { result } = renderHook(() => useBacktest());

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("guarda el resultado de un backtest exitoso", async () => {
    runBacktestMock.mockResolvedValue(respuesta("BTC-USD"));
    const { result } = renderHook(() => useBacktest());

    await act(async () => {
      await result.current.execute(params);
    });

    expect(result.current.data?.summary.ticker).toBe("BTC-USD");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("normaliza el rango a mes completo antes de llamar al API", async () => {
    // El selector permite elegir un día cualquiera, pero el backtest se pide
    // siempre sobre meses completos.
    runBacktestMock.mockResolvedValue(respuesta("BTC-USD"));
    const { result } = renderHook(() => useBacktest());

    await act(async () => {
      await result.current.execute({
        ...params,
        start_date: "2020-03-17",
        end_date: "2024-06-10",
      });
    });

    expect(runBacktestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        start_date: "2020-03-01",
        end_date: "2024-06-30",
      }),
    );
  });

  it("expone el mensaje de error del backend y limpia los datos", async () => {
    runBacktestMock.mockRejectedValue(new Error("El rango mínimo es 30 días"));
    const { result } = renderHook(() => useBacktest());

    await act(async () => {
      await result.current.execute(params);
    });

    expect(result.current.error).toBe("El rango mínimo es 30 días");
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("no deja loading colgado si el API falla", async () => {
    runBacktestMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useBacktest());

    await act(async () => {
      await result.current.execute(params);
    });

    expect(result.current.loading).toBe(false);
  });

  it("una respuesta vieja que llega tarde no pisa a la nueva", async () => {
    // El usuario cambia de activo antes de que vuelva el primer pedido. Si el
    // guard de secuencia fallara, la UI terminaría mostrando el resultado viejo.
    let resolverPrimera!: (v: BacktestResponse) => void;
    let resolverSegunda!: (v: BacktestResponse) => void;
    runBacktestMock
      .mockReturnValueOnce(
        new Promise<BacktestResponse>((r) => {
          resolverPrimera = r;
        }),
      )
      .mockReturnValueOnce(
        new Promise<BacktestResponse>((r) => {
          resolverSegunda = r;
        }),
      );

    const { result } = renderHook(() => useBacktest());

    act(() => {
      void result.current.execute({ ...params, ticker: "BTC-USD" });
    });
    act(() => {
      void result.current.execute({ ...params, ticker: "ETH-USD" });
    });

    // Llegan fuera de orden: primero la segunda, después la primera.
    await act(async () => {
      resolverSegunda(respuesta("ETH-USD"));
    });
    await act(async () => {
      resolverPrimera(respuesta("BTC-USD"));
    });

    await waitFor(() => {
      expect(result.current.data?.summary.ticker).toBe("ETH-USD");
    });
  });

  it("un error viejo que llega tarde no pisa el resultado nuevo", async () => {
    let rechazarPrimera!: (e: Error) => void;
    let resolverSegunda!: (v: BacktestResponse) => void;
    runBacktestMock
      .mockReturnValueOnce(
        new Promise<BacktestResponse>((_r, rej) => {
          rechazarPrimera = rej;
        }),
      )
      .mockReturnValueOnce(
        new Promise<BacktestResponse>((r) => {
          resolverSegunda = r;
        }),
      );

    const { result } = renderHook(() => useBacktest());

    act(() => {
      void result.current.execute(params);
    });
    act(() => {
      void result.current.execute({ ...params, ticker: "ETH-USD" });
    });

    await act(async () => {
      resolverSegunda(respuesta("ETH-USD"));
    });
    await act(async () => {
      rechazarPrimera(new Error("error viejo"));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.summary.ticker).toBe("ETH-USD");
  });

  it("reset vuelve al estado inicial", async () => {
    runBacktestMock.mockResolvedValue(respuesta("BTC-USD"));
    const { result } = renderHook(() => useBacktest());

    await act(async () => {
      await result.current.execute(params);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("reset invalida un pedido en vuelo", async () => {
    let resolver!: (v: BacktestResponse) => void;
    runBacktestMock.mockReturnValueOnce(
      new Promise<BacktestResponse>((r) => {
        resolver = r;
      }),
    );

    const { result } = renderHook(() => useBacktest());
    act(() => {
      void result.current.execute(params);
    });
    act(() => {
      result.current.reset();
    });
    await act(async () => {
      resolver(respuesta("BTC-USD"));
    });

    expect(result.current.data).toBeNull();
  });
});
