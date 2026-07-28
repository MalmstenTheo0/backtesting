import { describe, expect, it } from "vitest";

import type { ChartPoint } from "../types";
import { deriveRecentBuyRows } from "./deriveBuyRows";

function punto(
  date: string,
  price: number,
  is_buy: boolean,
  portfolio_value = 0,
): ChartPoint {
  return { date, price, invested: 0, portfolio_value, is_buy };
}

describe("deriveRecentBuyRows", () => {
  it("se queda solo con los puntos de compra", () => {
    const chart = [
      punto("2024-01-01", 100, true),
      punto("2024-01-02", 110, false),
      punto("2024-01-03", 120, true),
    ];

    const filas = deriveRecentBuyRows(chart, 100, 0);

    expect(filas.map((f) => f.date)).toEqual(["2024-01-03", "2024-01-01"]);
  });

  it("ordena de más reciente a más antigua", () => {
    const chart = [
      punto("2024-01-01", 100, true),
      punto("2024-02-01", 200, true),
      punto("2024-03-01", 300, true),
    ];

    const filas = deriveRecentBuyRows(chart, 100, 0);

    expect(filas.map((f) => f.date)).toEqual([
      "2024-03-01",
      "2024-02-01",
      "2024-01-01",
    ]);
  });

  it("corta en el límite pedido", () => {
    const chart = Array.from({ length: 10 }, (_, i) =>
      punto(`2024-01-${String(i + 1).padStart(2, "0")}`, 100, true),
    );

    expect(deriveRecentBuyRows(chart, 100, 0)).toHaveLength(5);
    expect(deriveRecentBuyRows(chart, 100, 0, 3)).toHaveLength(3);
  });

  it("devuelve las más recientes al recortar, no las primeras", () => {
    const chart = Array.from({ length: 10 }, (_, i) =>
      punto(`2024-01-${String(i + 1).padStart(2, "0")}`, 100, true),
    );

    const filas = deriveRecentBuyRows(chart, 100, 0, 2);

    expect(filas.map((f) => f.date)).toEqual(["2024-01-10", "2024-01-09"]);
  });

  it("calcula unidades descontando la comisión del aporte", () => {
    // Comisión 1 % sobre 100 => se invierten 99 efectivos a precio 100 => 0.99 u.
    const filas = deriveRecentBuyRows([punto("2024-01-01", 100, true)], 100, 1);

    expect(filas[0]?.commission).toBe(1);
    expect(filas[0]?.units).toBeCloseTo(0.99, 10);
    expect(filas[0]?.amount).toBe(100);
  });

  it("sin comisión invierte el aporte completo", () => {
    const filas = deriveRecentBuyRows([punto("2024-01-01", 50, true)], 100, 0);

    expect(filas[0]?.commission).toBe(0);
    expect(filas[0]?.units).toBe(2);
  });

  it("no divide por cero si el precio es cero", () => {
    const filas = deriveRecentBuyRows([punto("2024-01-01", 0, true)], 100, 0);

    expect(filas[0]?.units).toBe(0);
    expect(Number.isFinite(filas[0]?.units)).toBe(true);
  });

  it("propaga el valor del portfolio de cada punto", () => {
    const filas = deriveRecentBuyRows(
      [punto("2024-01-01", 100, true, 1234.5)],
      100,
      0,
    );

    expect(filas[0]?.portfolioValue).toBe(1234.5);
  });

  it("sin compras devuelve lista vacía", () => {
    const chart = [punto("2024-01-01", 100, false)];

    expect(deriveRecentBuyRows(chart, 100, 0)).toEqual([]);
  });

  it("con chart vacío devuelve lista vacía", () => {
    expect(deriveRecentBuyRows([], 100, 0)).toEqual([]);
  });
});
