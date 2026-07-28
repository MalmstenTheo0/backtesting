import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BacktestRequest } from "../types";
import { formatApiError, runBacktest } from "./api";

/**
 * `formatApiError` traduce el campo `detail` de FastAPI, que tiene dos formas muy
 * distintas: un string plano cuando el backend levanta HTTPException, y un array de
 * objetos cuando la validación de Pydantic rechaza el body. La UI muestra el resultado,
 * así que si esto falla el usuario ve "[object Object]".
 */
describe("formatApiError", () => {
  it("pasa un detail de texto tal cual", () => {
    expect(formatApiError("Ticker no permitido: 'TSLA'.")).toBe(
      "Ticker no permitido: 'TSLA'.",
    );
  });

  it("arma mensaje y ubicación de los errores de validación de Pydantic", () => {
    const detail = [
      { loc: ["body", "amount_per_period"], msg: "Input should be >= 1" },
    ];

    expect(formatApiError(detail)).toBe(
      "body.amount_per_period: Input should be >= 1",
    );
  });

  it("une varios errores de validación con separador", () => {
    const detail = [
      { loc: ["body", "ticker"], msg: "Field required" },
      { loc: ["body", "frequency"], msg: "Input should be 'daily'" },
    ];

    expect(formatApiError(detail)).toBe(
      "body.ticker: Field required · body.frequency: Input should be 'daily'",
    );
  });

  it("omite la ubicación cuando no viene", () => {
    expect(formatApiError([{ msg: "algo falló" }])).toBe("algo falló");
  });

  it("descarta los segmentos no textuales de loc", () => {
    const detail = [{ loc: ["body", 0, "ticker"], msg: "Field required" }];

    expect(formatApiError(detail)).toBe("body.ticker: Field required");
  });

  it("acepta un array de strings", () => {
    expect(formatApiError(["uno", "dos"])).toBe("uno · dos");
  });

  it("serializa objetos sueltos en vez de mostrar [object Object]", () => {
    const salida = formatApiError({ codigo: 42 });

    expect(salida).toBe('{"codigo":42}');
    expect(salida).not.toContain("[object Object]");
  });

  it("no rompe con null ni undefined", () => {
    expect(formatApiError(null)).toBe("null");
    expect(formatApiError(undefined)).toBe("undefined");
  });
});

describe("runBacktest", () => {
  const params: BacktestRequest = {
    ticker: "BTC-USD",
    amount_per_period: 100,
    frequency: "monthly",
    start_date: "2020-01-01",
    end_date: "2024-01-01",
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("hace POST con el body serializado", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ summary: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await runBacktest(params);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/backtest");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(params);
  });

  it("convierte un detail de error en Error con el mensaje del backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Unprocessable Entity",
        json: async () => ({ detail: "El rango mínimo es 30 días" }),
      }),
    );

    await expect(runBacktest(params)).rejects.toThrow(
      "El rango mínimo es 30 días",
    );
  });

  it("cae al statusText si el cuerpo del error no es JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("no es JSON");
        },
      }),
    );

    await expect(runBacktest(params)).rejects.toThrow("Internal Server Error");
  });
});
