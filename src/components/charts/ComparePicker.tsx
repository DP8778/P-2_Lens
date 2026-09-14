"use client";
import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Asset } from "@/lib/finance/domain";
import type { MarketAsset } from "@/lib/market-data/types";
import { AssetSearch } from "@/components/portfolio/AssetSearch";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";

export function ComparePicker({ assets, selected, onSelect }: { assets: Asset[]; selected: string; onSelect: (assetId: string) => void }) {
  const { mode, market, prepareComparison } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [marketSearch, setMarketSearch] = useState(false);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const chooseExternal = async (asset: MarketAsset) => {
    setLoading(asset.symbol);
    setError("");
    try { await prepareComparison(asset); onSelect(asset.id); setOpen(false); setMarketSearch(false); }
    catch { setError("Historii instrumentu se nepodařilo načíst. Zkuste to znovu."); }
    finally { setLoading(""); }
  };
  return (
    <div className="compare-picker">
      <button className="compare-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span>Porovnat</span><strong>{assets.find((asset) => asset.id === selected)?.symbol ?? market.comparisonAssets?.find((asset) => asset.id === selected)?.symbol ?? (selected ? "Externí aktivum" : "Žádné aktivum")}</strong><ChevronDown size={14} /></button>
      {open && <div className="compare-popover glass">
        <div className="compare-popover-heading"><strong>Porovnat výkon</strong><button aria-label="Zavřít porovnání" onClick={() => setOpen(false)}>×</button></div>
        <p>V portfoliu</p>
        <div className="compare-holdings">
          <button aria-pressed={!selected} onClick={() => { onSelect(""); setOpen(false); }}>Bez porovnání{!selected && <Check size={14} />}</button>
          {assets.filter((asset) => asset.type !== "cash").map((asset) => <button key={asset.id} aria-pressed={selected === asset.id} onClick={() => { onSelect(asset.id); setOpen(false); }}>{asset.symbol}<small>{asset.name}</small>{selected === asset.id && <Check size={14} />}</button>)}
        </div>
        {mode === "personal" && <>
          <button className="market-search-toggle" aria-expanded={marketSearch} onClick={() => setMarketSearch((value) => !value)}><Search size={15} />Hledat na trhu</button>
          {marketSearch && <div className="compare-market-search"><AssetSearch mode="personal" existingIds={assets.map((asset) => asset.id)} onSelect={(asset) => void chooseExternal(asset as MarketAsset)} /></div>}
          {loading && <p role="status" className="compare-loading">Načítám historii {loading}… Portfolio zůstává zobrazené.</p>}
          {error && <p role="alert" className="compare-loading">{error}</p>}
        </>}
      </div>}
    </div>
  );
}
