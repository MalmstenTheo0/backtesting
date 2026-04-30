import { AssetSelector } from "./AssetSelector";
import { DateRangePicker } from "./DateRangePicker";
import { FrequencySelector } from "./FrequencySelector";

export function ConfigPanel(): JSX.Element {
  return (
    <section className="rounded border border-slate-200 p-4" aria-label="Configuración">
      <div className="flex flex-col gap-4">
        <AssetSelector />
        <DateRangePicker />
        <FrequencySelector />
      </div>
    </section>
  );
}
