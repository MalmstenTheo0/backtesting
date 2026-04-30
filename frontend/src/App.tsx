import { BacktestChart } from "./components/Chart/BacktestChart";
import { ConfigPanel } from "./components/ConfigPanel/ConfigPanel";
import { ResultsPanel } from "./components/ResultsPanel/ResultsPanel";

export default function App(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">DCA Backtester</h1>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6">
        <ConfigPanel />
        <ResultsPanel />
        <BacktestChart />
      </main>
    </div>
  );
}
