import { useCallback, useState } from "react";

import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "./lib/themeStorage";
import { useBacktest } from "./hooks/useBacktest";
import { BacktestChart } from "./components/Chart/BacktestChart";
import { ConfigPanel } from "./components/ConfigPanel/ConfigPanel";
import { ResultsPanel } from "./components/ResultsPanel/ResultsPanel";

export default function App(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const { data, loading, error, execute, reset } = useBacktest();

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      persistTheme(next);
      applyThemeToDocument(next);
      return next;
    });
  }, []);

  const handleParametersChange = useCallback(() => {
    reset();
  }, [reset]);

  const hasResults = data !== null;

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="sticky top-0 z-10 flex h-[52px] items-center gap-3 border-b border-border bg-surface px-8 transition-colors">
        <span className="font-sans text-[15px] font-semibold tracking-tight">
          DCA Backtester
        </span>
        <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wider text-text-muted">
          MVP v0.1
        </span>
        <div className="flex-1" />
        <button
          type="button"
          className="flex cursor-pointer select-none items-center gap-2 rounded-md p-1 transition-colors hover:bg-surface-2"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        >
          <span className="text-xs font-medium tracking-wide text-text-muted">
            {theme === "dark" ? "Dark" : "Light"}
          </span>
          <span
            className={[
              "relative h-[22px] w-10 shrink-0 rounded-full border transition-colors",
              theme === "dark"
                ? "border-accent bg-accent"
                : "border-border-strong bg-border-strong",
            ].join(" ")}
          >
            <span
              className={[
                "absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300 ease-out",
                theme === "dark" ? "translate-x-[18px]" : "translate-x-[3px]",
              ].join(" ")}
            />
          </span>
        </button>
      </header>

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-5 px-8 pb-10 pt-5 md:grid-cols-[272px_1fr] md:items-start">
        <ConfigPanel
          onSubmit={(body) => {
            void execute(body);
          }}
          loading={loading}
          error={error}
          onParametersChange={handleParametersChange}
        />

        {hasResults && data ? (
          <div className="flex flex-col gap-4 results-enter">
            <ResultsPanel data={data} />
            <BacktestChart data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
