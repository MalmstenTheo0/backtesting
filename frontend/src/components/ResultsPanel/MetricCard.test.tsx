import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MetricCard } from "./MetricCard";

describe("MetricCard", () => {
  it("muestra la etiqueta y el valor", () => {
    render(<MetricCard label="Valor final" value="US$ 15.000" />);

    expect(screen.getByText("Valor final")).toBeInTheDocument();
    expect(screen.getByText("US$ 15.000")).toBeInTheDocument();
  });

  it("muestra el subtítulo cuando se pasa", () => {
    render(<MetricCard label="CAGR" value="+12,50%" sub="anualizado" />);

    expect(screen.getByText("anualizado")).toBeInTheDocument();
  });

  it("omite el subtítulo cuando no se pasa", () => {
    const { container } = render(<MetricCard label="CAGR" value="+12,50%" />);

    expect(container.textContent).toBe("CAGR+12,50%");
  });

  it("resalta el valor cuando es positivo", () => {
    render(<MetricCard label="Retorno" value="+25%" positive />);

    expect(screen.getByText("+25%")).toHaveClass("text-positive");
  });

  it("usa el color neutro cuando no es positivo", () => {
    render(<MetricCard label="Retorno" value="-25%" />);

    expect(screen.getByText("-25%")).toHaveClass("text-text-primary");
    expect(screen.getByText("-25%")).not.toHaveClass("text-positive");
  });
});
