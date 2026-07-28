import { describe, expect, it } from "vitest";

import {
  addYearsLocal,
  formatMetricPercent,
  formatMonthYearThreeLetters,
  formatMoney,
  formatPercentPlain,
  toIsoDateLocal,
  toMonthEndIso,
  toMonthStartIso,
} from "./format";

/**
 * `Intl` en locale es-AR separa el símbolo con un espacio duro (U+00A0), no uno normal.
 * Comparar contra un espacio común haría fallar los tests por un carácter invisible.
 */
function normalizarEspacios(s: string): string {
  return s.replace(/ /g, " ");
}

describe("formatMoney", () => {
  it("sin decimales redondea y usa punto como separador de miles", () => {
    expect(normalizarEspacios(formatMoney(1234567.89))).toBe("US$ 1.234.568");
  });

  it("con decimales usa coma decimal y siempre dos dígitos", () => {
    expect(normalizarEspacios(formatMoney(1234.5, true))).toBe("US$ 1.234,50");
  });

  it("formatea el cero", () => {
    expect(normalizarEspacios(formatMoney(0))).toBe("US$ 0");
  });

  it("formatea negativos", () => {
    expect(normalizarEspacios(formatMoney(-500))).toContain("500");
    expect(formatMoney(-500)).toMatch(/-/);
  });
});

describe("formatMetricPercent", () => {
  it("antepone + a los valores no negativos", () => {
    expect(formatMetricPercent(49.3)).toBe("+49.30%");
  });

  it("el cero cuenta como no negativo y lleva +", () => {
    expect(formatMetricPercent(0)).toBe("+0.00%");
  });

  it("los negativos ya traen su signo y no se les agrega otro", () => {
    expect(formatMetricPercent(-12.5)).toBe("-12.50%");
  });

  it("respeta la cantidad de dígitos pedida", () => {
    expect(formatMetricPercent(49.345, 1)).toBe("+49.3%");
    expect(formatMetricPercent(49.345, 0)).toBe("+49%");
  });
});

describe("formatPercentPlain", () => {
  it("no agrega signo a los positivos", () => {
    expect(formatPercentPlain(49.3)).toBe("49.30%");
  });

  it("conserva el signo de los negativos", () => {
    expect(formatPercentPlain(-1)).toBe("-1.00%");
  });
});

describe("formatMonthYearThreeLetters", () => {
  it("abrevia el mes en español con inicial mayúscula", () => {
    expect(formatMonthYearThreeLetters("2016-06-15")).toBe("Jun 2016");
  });

  it("acepta el prefijo YYYY-MM sin día", () => {
    expect(formatMonthYearThreeLetters("2024-01")).toBe("Ene 2024");
  });

  it("cubre los doce meses", () => {
    const meses = Array.from({ length: 12 }, (_, i) =>
      formatMonthYearThreeLetters(`2024-${String(i + 1).padStart(2, "0")}`),
    );
    expect(meses).toEqual([
      "Ene 2024",
      "Feb 2024",
      "Mar 2024",
      "Abr 2024",
      "May 2024",
      "Jun 2024",
      "Jul 2024",
      "Ago 2024",
      "Sep 2024",
      "Oct 2024",
      "Nov 2024",
      "Dic 2024",
    ]);
  });

  it("devuelve cadena vacía ante entradas inválidas", () => {
    expect(formatMonthYearThreeLetters("no-es-fecha")).toBe("");
    expect(formatMonthYearThreeLetters("2024-13")).toBe("");
    expect(formatMonthYearThreeLetters("2024-00")).toBe("");
    expect(formatMonthYearThreeLetters("")).toBe("");
  });
});

describe("toIsoDateLocal", () => {
  it("usa la fecha local, no UTC", () => {
    // Con getUTCDate() un 31 a la noche en UTC-3 se convertiría en el día 1 del mes
    // siguiente. La fecha local es la que ve el usuario en el selector.
    expect(toIsoDateLocal(new Date(2024, 0, 31, 23, 30))).toBe("2024-01-31");
  });

  it("rellena mes y día con cero a la izquierda", () => {
    expect(toIsoDateLocal(new Date(2024, 2, 5))).toBe("2024-03-05");
  });
});

describe("addYearsLocal", () => {
  it("resta años (va hacia atrás pese al nombre)", () => {
    expect(toIsoDateLocal(addYearsLocal(new Date(2024, 5, 15), 3))).toBe(
      "2021-06-15",
    );
  });

  it("no muta la fecha original", () => {
    const original = new Date(2024, 5, 15);
    addYearsLocal(original, 3);
    expect(toIsoDateLocal(original)).toBe("2024-06-15");
  });
});

describe("toMonthStartIso", () => {
  it("lleva cualquier día al primero del mes", () => {
    expect(toMonthStartIso("2024-03-17")).toBe("2024-03-01");
  });

  it("acepta el prefijo YYYY-MM", () => {
    expect(toMonthStartIso("2024-03")).toBe("2024-03-01");
  });

  it("ante una entrada inválida devuelve lo recibido sin romper", () => {
    expect(toMonthStartIso("basura")).toBe("basura");
    expect(toMonthStartIso("2024-99")).toBe("2024-99");
  });
});

describe("toMonthEndIso", () => {
  it("resuelve el último día de un mes de 31", () => {
    expect(toMonthEndIso("2024-01-05")).toBe("2024-01-31");
  });

  it("resuelve el último día de un mes de 30", () => {
    expect(toMonthEndIso("2024-04-05")).toBe("2024-04-30");
  });

  it("contempla febrero en año bisiesto", () => {
    expect(toMonthEndIso("2024-02-10")).toBe("2024-02-29");
  });

  it("contempla febrero en año no bisiesto", () => {
    expect(toMonthEndIso("2023-02-10")).toBe("2023-02-28");
  });

  it("contempla el caso de siglo no bisiesto", () => {
    // 1900 no fue bisiesto pese a ser divisible por 4.
    expect(toMonthEndIso("1900-02-10")).toBe("1900-02-28");
  });

  it("ante una entrada inválida devuelve lo recibido sin romper", () => {
    expect(toMonthEndIso("basura")).toBe("basura");
  });
});
