import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addYearsLocal,
  toIsoDateLocal,
  toMonthEndIso,
  toMonthStartIso,
} from "../../lib/format";
import type { AssetItem, BacktestRequest, Frequency } from "../../types";
import { getAssets } from "../../services/api";
import { AssetSelector } from "./AssetSelector";
import DateRangePicker from "./DateRangePicker";

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "daily", label: "Diaria" },
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
];

const ETF_DAILY_DISABLED_TITLE =
  "No disponible para ETFs en plan gratuito";

function defaultDateRange(): { start: string; end: string } {
  const today = new Date();
  const end = toMonthEndIso(toIsoDateLocal(today));
  const start = toMonthStartIso(toIsoDateLocal(addYearsLocal(today, 5)));
  return { start, end };
}

function pickDefaultTicker(assets: AssetItem[]): string {
  const spy = assets.find((a) => a.ticker === "SPY");
  if (spy) {
    return spy.ticker;
  }
  return assets[0]?.ticker ?? "";
}

export interface ConfigPanelProps {
  onSubmit: (body: BacktestRequest) => void;
  loading: boolean;
  error: string | null;
  onParametersChange: () => void;
}

export function ConfigPanel({
  onSubmit,
  loading,
  error,
  onParametersChange,
}: ConfigPanelProps): JSX.Element {
  const { start: defaultStart, end: defaultEnd } = defaultDateRange();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const [ticker, setTicker] = useState("");
  const [amount, setAmount] = useState(100);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [commissionStr, setCommissionStr] = useState("0.1");

  const notify = useCallback(() => {
    onParametersChange();
  }, [onParametersChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAssetsLoading(true);
      setAssetsError(null);
      try {
        const res = await getAssets();
        if (cancelled) {
          return;
        }
        setAssets(res.assets);
        setTicker((prev) => {
          if (prev) {
            return prev;
          }
          return pickDefaultTicker(res.assets);
        });
      } catch (e) {
        if (!cancelled) {
          setAssetsError(e instanceof Error ? e.message : "Error al cargar activos");
        }
      } finally {
        if (!cancelled) {
          setAssetsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.ticker === ticker),
    [assets, ticker],
  );

  useEffect(() => {
    if (selectedAsset?.type === "etf" && frequency === "daily") {
      setFrequency("monthly");
      notify();
    }
  }, [selectedAsset?.type, frequency, notify]);

  const handleDatesChange = useCallback(
    (start: string, end: string) => {
      setStartDate(start);
      setEndDate(end);
      notify();
    },
    [notify],
  );

  const commissionParsed = useMemo(() => {
    const t = commissionStr.trim();
    if (t === "") {
      return 0;
    }
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [commissionStr]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!ticker || loading) {
        return;
      }
      const body: BacktestRequest = {
        ticker,
        amount_per_period: amount,
        frequency,
        start_date: startDate,
        end_date: endDate,
        strategy: "dca",
      };
      if (Number.isFinite(commissionParsed)) {
        body.commission_pct = Math.min(100, Math.max(0, commissionParsed));
      }
      onSubmit(body);
    },
    [
      ticker,
      loading,
      amount,
      frequency,
      startDate,
      endDate,
      commissionParsed,
      onSubmit,
    ],
  );

  return (
    <aside
      className="sticky top-[72px] flex flex-col gap-[18px] rounded-panel border border-border bg-surface p-5 shadow-panel"
      aria-label="Configuración"
    >
      <div className="border-b border-border pb-3.5 text-[11px] font-medium uppercase tracking-[0.07em] text-section-title">
        Configuración
      </div>

      <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
        <AssetSelector
          assets={assets}
          value={ticker}
          onChange={(v) => {
            setTicker(v);
            notify();
          }}
          disabled={loading}
          loading={assetsLoading}
          loadError={assetsError}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Monto por período (USD)
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            disabled={loading}
            onChange={(e) => {
              setAmount(Number(e.target.value));
              notify();
            }}
            className="h-9 w-full rounded-control border border-border-strong bg-surface-2 px-2.5 font-sans text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Frecuencia
          </label>
          <div
            className="grid grid-cols-3 overflow-hidden rounded-control border border-border-strong"
            role="group"
            aria-label="Frecuencia"
          >
            {FREQUENCY_OPTIONS.map((opt) => {
              const active = frequency === opt.value;
              const dailyBlocked =
                opt.value === "daily" && selectedAsset?.type === "etf";
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={loading || dailyBlocked}
                  title={dailyBlocked ? ETF_DAILY_DISABLED_TITLE : undefined}
                  onClick={() => {
                    if (dailyBlocked) {
                      return;
                    }
                    setFrequency(opt.value);
                    notify();
                  }}
                  className={[
                    "border-r border-border-strong px-1 py-2 text-center font-sans text-[13px] font-medium leading-normal transition-colors last:border-r-0",
                    active
                      ? "bg-accent text-white"
                      : "bg-surface-2 text-text-secondary hover:bg-surface",
                    dailyBlocked
                      ? "cursor-not-allowed opacity-50 hover:bg-surface-2"
                      : "",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          disabled={loading}
          onChange={handleDatesChange}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-text-secondary">
            Comisión por operación{" "}
            <span className="ml-1 text-[10px] font-normal text-text-muted">
              opcional
            </span>
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            placeholder="0"
            value={commissionStr}
            disabled={loading}
            onChange={(e) => {
              setCommissionStr(e.target.value);
              notify();
            }}
            className="h-9 w-full rounded-control border border-border-strong bg-surface-2 px-2.5 font-sans text-[13px] font-normal leading-normal text-text-primary focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)]"
          />
        </div>

        {error ? (
          <p
            className="rounded-control border border-red-500/40 bg-red-500/10 px-2.5 py-2 text-xs text-red-600 dark:text-red-400"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !ticker || assetsLoading}
          className="mt-0.5 flex h-10 w-full items-center justify-center rounded-control bg-accent font-sans text-[13px] font-semibold leading-normal text-white transition-[background,transform] hover:bg-accent-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Calculando…" : "Calcular"}
        </button>
      </form>
    </aside>
  );
}
