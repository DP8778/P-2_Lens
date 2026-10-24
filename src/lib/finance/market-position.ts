type Copy = { "cs-CZ": string; "en-US": string };
type Source = { title: string; url: string; published: string; kind: "primary" | "secondary" };
export type MarketPosition = {
  id: string;
  title: Copy;
  scope: Copy;
  period: string;
  measure: "unit-shipments";
  shares: { name: string; sharePct: number }[];
  rounded: boolean;
  size?: { value: number; unit: "boards" };
  researcher: string;
  sources: Source[];
};
const amdReport = "https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm";
const nvidiaReport = "https://investor.nvidia.com/news/press-release-details/2026/NVIDIA-Announces-Financial-Results-for-Fourth-Quarter-and-Fiscal-2026/";
const intelReport = "https://www.intc.com/filings-reports/all-sec-filings/content/0000050863-26-000011/intc-20251227.htm";
const graphicsReport = "https://www.jonpeddie.com/news/q226-pc-graphics-aib-shipments-increased-10-from-last-quarter-to-12-million-units/";

/** Reviewed public observations. Unit shares, revenue totals and forward TAMs are never interchangeable. */
export const amdMarketPosition = {
  assetId: "twelvedata:XNGS:AMD",
  reviewedAt: "2026-10-24",
  industry: {
    value: 301_900_000_000,
    currency: "USD",
    year: 2025,
    scope: { "cs-CZ": "Globální tržby za logické čipy", "en-US": "Global logic semiconductor sales" },
    source: { title: "SIA / WSTS · 2025 sales", published: "2026-02-06", kind: "primary",
      url: "https://www.semiconductors.org/global-annual-semiconductor-sales-increase-25-6-to-791-7-billion-in-2025/" } satisfies Source,
  },
  markets: [
    {
      id: "server-x86", title: { "cs-CZ": "Serverové procesory x86", "en-US": "x86 server processors" },
      scope: { "cs-CZ": "Zahrnuje také x86 procesory pro síťové a úložné systémy. Nezahrnuje Arm ani AI akcelerátory.", "en-US": "Also includes x86 networking and storage processors. Excludes Arm and AI accelerators." },
      period: "Q2 2026", measure: "unit-shipments", rounded: false,
      shares: [{ name: "AMD", sharePct: 34.5 }, { name: "Intel", sharePct: 65.5 }],
      researcher: "Mercury Research",
      sources: [{ title: "Mercury Research via Tom’s Hardware", published: "2026-08-22", kind: "secondary",
        url: "https://www.tomshardware.com/pc-components/cpus/desktop-cpu-shipments-crater-20-percent-amid-high-component-costs-but-amd-gains-record-share-despite-ugly-desktop-processor-market-intel-floods-laptop-market-with-millions-of-cpus-but-amd-still-sets-all-time-share-records" }],
    },
    {
      id: "desktop-graphics", title: { "cs-CZ": "Samostatné grafické karty pro PC", "en-US": "Desktop graphics add-in boards" },
      scope: { "cs-CZ": "Samostatné grafické karty pro stolní PC (AIB). Bez integrovaných GPU, notebooků a datacenter.", "en-US": "Desktop add-in boards (AIB). Excludes integrated GPUs, notebooks and data centers." },
      period: "Q2 2026", measure: "unit-shipments", rounded: true,
      size: { value: 12_500_000, unit: "boards" },
      shares: [{ name: "AMD", sharePct: 8 }, { name: "NVIDIA", sharePct: 90 }, { name: "Intel", sharePct: 2 }],
      researcher: "Jon Peddie Research",
      sources: [
        { title: "Jon Peddie Research · AIB volume", published: "2026-09-09", kind: "primary", url: graphicsReport },
        { title: "JPR via Tom’s Hardware · rounded shares", published: "2026-09-11", kind: "secondary",
          url: "https://www.tomshardware.com/pc-components/gpus/desktop-graphics-card-shipments-hit-four-year-high-of-12-5-million-despite-increasing-prices-nvidia-takes-90-percent-share-as-gamers-rush-to-beat-looming-price-spikes" },
      ],
    },
  ] satisfies MarketPosition[],
  competitors: [
    {
      name: "AMD", role: { "cs-CZ": "CPU, GPU a adaptivní čipy", "en-US": "CPUs, GPUs and adaptive chips" },
      model: { "cs-CZ": "Navrhuje procesory EPYC a Ryzen, grafiky Radeon i AI akcelerátory Instinct. Výrobu čipů zadává partnerům, zejména TSMC.", "en-US": "Designs EPYC and Ryzen processors, Radeon graphics and Instinct AI accelerators. Outsources chip manufacturing, notably to TSMC." },
      strategy: { "cs-CZ": "Sází na chipletovou architekturu, široké portfolio výpočetních čipů a otevřený software ROCm. Rozšiřuje nabídku také na celé AI racky.", "en-US": "Bets on chiplet architecture, a broad compute portfolio and open ROCm software. Also expanding into complete AI racks." },
      watch: { "cs-CZ": "Sledovat přijetí ROCm u zákazníků a dostupnost výrobních a pouzdřicích kapacit.", "en-US": "Watch customer adoption of ROCm and manufacturing and packaging capacity." },
      source: { title: "AMD · FY2025 Form 10-K", url: amdReport, published: "2026-02-04", kind: "primary" } satisfies Source,
    },
    {
      name: "NVIDIA", role: { "cs-CZ": "GPU a propojená AI platforma", "en-US": "GPUs and an integrated AI platform" },
      model: { "cs-CZ": "Propojuje GPU, procesory, síťové prvky a celé systémy se softwarovými knihovnami CUDA-X a vývojářskými nástroji.", "en-US": "Combines GPUs, CPUs, networking and complete systems with CUDA-X software libraries and developer tools." },
      strategy: { "cs-CZ": "Sází na provázaný hardware a software: zákazník staví a optimalizuje aplikace nad celou platformou.", "en-US": "Bets on tightly integrated hardware and software: customers build and optimize applications across the platform." },
      watch: { "cs-CZ": "Sledovat využití celých systémů a to, zda zákazníci zůstávají u stejného softwarového prostředí.", "en-US": "Watch adoption of complete systems and whether customers retain the same software environment." },
      source: { title: "NVIDIA · FY2026 results and platforms", url: nvidiaReport, published: "2026-02-25", kind: "primary" } satisfies Source,
    },
    {
      name: "Intel", role: { "cs-CZ": "Procesory i vlastní výroba", "en-US": "Processors and in-house manufacturing" },
      model: { "cs-CZ": "Prodává vlastní procesory a současně provozuje výrobní a pouzdřicí služby Intel Foundry. Ta zatím slouží převážně vlastním produktům.", "en-US": "Sells its own processors and operates Intel Foundry manufacturing and packaging services, which currently serve mainly its own products." },
      strategy: { "cs-CZ": "Sází také na vlastní výrobní procesy a pokročilé pouzdření. Liší se tak mírou zapojení do samotné výroby čipů.", "en-US": "Also bets on its own process technology and advanced packaging, differing in its involvement in chip manufacturing." },
      watch: { "cs-CZ": "Sledovat výrobní provedení, využití továren a získávání externích zákazníků foundry.", "en-US": "Watch manufacturing execution, factory utilization and external foundry customer wins." },
      source: { title: "Intel · FY2025 Form 10-K", url: intelReport, published: "2026-01-23", kind: "primary" } satisfies Source,
    },
  ],
};

export function companyMarketPosition(assetId: string) {
  if (assetId !== amdMarketPosition.assetId) return undefined;
  const markets = amdMarketPosition.markets.filter(market =>
    market.shares.every(share => Number.isFinite(share.sharePct) && share.sharePct >= 0 && share.sharePct <= 100)
    && Math.abs(market.shares.reduce((sum, share) => sum + share.sharePct, 0) - 100) < .001,
  );
  return { ...amdMarketPosition, markets };
}

export function marketLeader(market: MarketPosition) {
  return market.shares.reduce((leader, share) => share.sharePct > leader.sharePct ? share : leader);
}
