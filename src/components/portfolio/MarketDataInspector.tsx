import type { Asset } from "@/lib/finance/domain";
import type { MarketRuntime, PortfolioMode } from "./PortfolioProvider";

export function MarketDataInspector({ mode, assets, market }: { mode: PortfolioMode; assets: Asset[]; market: MarketRuntime }) {
  if (process.env.NODE_ENV === "production") return null;
  const currencies = [...new Set(assets.map((asset) => asset.currency).filter((currency) => currency !== "CZK"))];
  return (
    <details className="analysis-inspector market-inspector">
      <summary>Dev · Market data</summary>
      <dl>
        <div><dt>Portfolio mode</dt><dd>{mode}</dd></div>
        <div><dt>Provider</dt><dd>{mode === "demo" ? "demo" : "twelvedata"}</dd></div>
        <div><dt>Held market assets</dt><dd>{assets.filter((asset) => asset.symbol !== "SPY").length}</dd></div>
        <div><dt>Quote freshness</dt><dd>{market.state}</dd></div>
        <div><dt>History points</dt><dd>{market.prices.length}</dd></div>
        <div><dt>FX pairs</dt><dd>{currencies.map((currency) => `${currency}/CZK`).join(", ") || "—"}</dd></div>
        <div><dt>Last refresh</dt><dd>{market.lastRefresh ?? "—"}</dd></div>
        <div><dt>Source</dt><dd>{market.source ?? "—"}</dd></div>
        <div><dt>Error</dt><dd>{market.error ?? "—"}</dd></div>
      </dl>
    </details>
  );
}

