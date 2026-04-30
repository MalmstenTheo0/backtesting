import { ComparisonTable } from "./ComparisonTable";
import { MetricCard } from "./MetricCard";

export function ResultsPanel(): JSX.Element {
  return (
    <section className="rounded border border-slate-200 p-4" aria-label="Resultados">
      <div className="flex flex-col gap-4">
        <MetricCard />
        <ComparisonTable />
      </div>
    </section>
  );
}
