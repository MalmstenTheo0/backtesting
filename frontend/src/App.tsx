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
import CompoundCalculator from "./components/CompoundCalculator/CompoundCalculator";
import PortfolioAllocator from "./components/PortfolioAllocator/PortfolioAllocator";

type AppTab = "backtester" | "compound" | "portfolio";

const TABS: { id: AppTab; label: string }[] = [
  { id: "backtester", label: "Backtester" },
  { id: "compound", label: "Interés Compuesto" },
  { id: "portfolio", label: "Cartera" },
];

export default function App(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [activeTab, setActiveTab] = useState<AppTab>("backtester");
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
      <header className="sticky top-0 z-10 border-b border-border bg-surface transition-colors">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-8 py-3 sm:h-[52px] sm:flex-row sm:items-center sm:gap-4 sm:py-0">
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-[15px] font-semibold tracking-tight">
              DCA Backtester
            </span>
            <span className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
              MVP v0.1
            </span>
          </div>

          <nav
            className="flex min-w-0 flex-1 justify-center"
            aria-label="Secciones"
          >
            <div
              className="inline-flex max-w-full overflow-x-auto rounded-control border border-border-strong"
              role="tablist"
            >
              {TABS.map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      "shrink-0 border-r border-border-strong px-3 py-2 text-center text-[13px] font-medium leading-normal transition-colors last:border-r-0 sm:px-4 sm:py-2",
                      active
                        ? "bg-accent text-white"
                        : "bg-surface-2 text-text-secondary hover:bg-surface",
                    ].join(" ")}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="flex justify-end sm:ml-0 sm:justify-start">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
      </header>

      {activeTab === "backtester" ? (
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
      ) : null}

      {activeTab === "compound" ? (
        <div className="mx-auto max-w-[1280px] px-8 pb-10 pt-5">
          <CompoundCalculator />
        </div>
      ) : null}

      {activeTab === "portfolio" ? (
        <div className="mx-auto max-w-[1280px] px-8 pb-10 pt-5">
          <PortfolioAllocator />
        </div>
      ) : null}
    </div>
  );
}
