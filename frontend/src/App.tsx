import { useCallback, useEffect, useState } from "react";

import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "./lib/themeStorage";
import { useBacktest } from "./hooks/useBacktest";
import { ConfigPanel } from "./components/ConfigPanel/ConfigPanel";
import { ResultsPanel } from "./components/ResultsPanel/ResultsPanel";
import { ThemeToggle } from "./components/ThemeToggle/ThemeToggle";

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

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

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
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
          <div
            key={`${data.summary.ticker}-${data.summary.start_date}-${data.summary.end_date}-${data.summary.amount_per_period}-${data.summary.frequency}-${data.summary.commission_pct}`}
            className="flex flex-col gap-4 results-enter"
          >
            <ResultsPanel data={data} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
