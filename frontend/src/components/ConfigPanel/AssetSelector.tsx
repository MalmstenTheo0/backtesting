import type { AssetItem } from "../../types";

const CHEVRON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23647480' d='M5 7L0 2h10z'/%3E%3C/svg%3E";

export interface AssetSelectorProps {
  assets: AssetItem[];
  value: string;
  onChange: (ticker: string) => void;
  disabled?: boolean;
  loading?: boolean;
  loadError?: string | null;
}

export function AssetSelector({
  assets,
  value,
  onChange,
  disabled,
  loading,
  loadError,
}: AssetSelectorProps): JSX.Element {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">Activo</label>
      <select
        className="h-9 w-full cursor-pointer appearance-none rounded-control border border-border-strong bg-surface-2 py-0 pl-2.5 pr-7 text-[13px] font-normal leading-normal text-text-primary transition-[border-color,background,color] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-[var(--focus-ring)] disabled:opacity-60"
        style={{
          backgroundImage: `url("${CHEVRON}")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
        }}
        disabled={disabled || loading || assets.length === 0}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {assets.length === 0 && !loading ? (
          <option value="">Sin activos</option>
        ) : (
          assets.map((a) => (
            <option key={a.ticker} value={a.ticker}>
              {a.name} ({a.ticker})
            </option>
          ))
        )}
      </select>
      {loading ? (
        <p className="text-xs text-text-muted">Cargando activos…</p>
      ) : null}
      {loadError ? (
        <p className="text-xs text-red-500">{loadError}</p>
      ) : null}
    </div>
  );
}
