export type CompanyProfile = {
  assetId: string;
  description: { "cs-CZ": string; "en-US": string };
  sourceLabel: string;
  sourceUrl: string;
  featuredRevenueMix?: boolean;
};

/** Short issuer descriptions reviewed against the linked primary company reports. */
const profiles: readonly CompanyProfile[] = [
  {
    assetId: "twelvedata:XNGM:TTD",
    description: {
      "cs-CZ": "The Trade Desk provozuje nákupní reklamní platformu (DSP). Agentury a inzerenti přes ni vybírají reklamní prostor a řídí kampaně. Platí poplatek za platformu a služby či data; firma většinu nákladů na nakoupený prostor vykazuje netto. Má jeden provozní segment. CTV je reklamní kanál, Kokai platforma a UID2 identitní iniciativa, nikoli vykázané výnosové segmenty.",
      "en-US": "The Trade Desk operates a demand-side advertising platform (DSP). Agencies and advertisers use it to buy inventory and manage campaigns, paying platform fees and for services or data. Most purchased inventory costs are reported net. It has one operating segment; CTV, Kokai and UID2 are not reported revenue segments.",
    },
    sourceLabel: "The Trade Desk · FY2025 Form 10-K",
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/1671933/000167193326000014/ttd-20251231.htm",
  },
  {
    assetId: "twelvedata:XNGS:AAPL",
    description: {
      "cs-CZ": "Apple navrhuje a prodává spotřební elektroniku a provozuje služby navázané na zařízení, software a svůj ekosystém.",
      "en-US": "Apple designs and sells consumer devices and operates services connected to its hardware, software and ecosystem.",
    },
    sourceLabel: "Apple · Annual Reports on Form 10-K",
    sourceUrl: "https://investor.apple.com/investor-relations/default.aspx",
  },
  {
    assetId: "twelvedata:XNGS:AMD",
    description: {
      "cs-CZ": "AMD navrhuje výpočetní produkty pro datová centra, osobní počítače, herní zařízení a vestavěné systémy; tržby vykazuje ve třech segmentech Data Center, Client and Gaming a Embedded.",
      "en-US": "AMD designs computing products for data centers, personal computers, gaming devices and embedded systems, reporting revenue in Data Center, Client and Gaming, and Embedded.",
    },
    sourceLabel: "AMD · Form 10-K 2025",
    sourceUrl: "https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm",
    featuredRevenueMix: true,
  },
  {
    assetId: "twelvedata:XNGS:NVDA",
    description: {
      "cs-CZ": "NVIDIA vyvíjí platformy pro akcelerované výpočty, které propojují GPU, síťové technologie, systémy a software pro datová centra i grafiku.",
      "en-US": "NVIDIA develops accelerated-computing platforms spanning GPUs, networking, systems and software for data centers and graphics.",
    },
    sourceLabel: "NVIDIA · Annual Reports",
    sourceUrl: "https://investor.nvidia.com/financial-info/annual-reports-and-proxies/default.aspx",
  },
  {
    assetId: "twelvedata:XNGS:MSFT",
    description: {
      "cs-CZ": "Microsoft vytváří produktivní a podnikový software, cloudovou infrastrukturu a služby, operační systémy i herní produkty.",
      "en-US": "Microsoft develops productivity and business software, cloud infrastructure and services, operating systems and gaming products.",
    },
    sourceLabel: "Microsoft · Annual Reports",
    sourceUrl: "https://www.microsoft.com/en-us/investor/annual-reports/",
  },
] as const;

export function companyProfileFor(assetId: string) {
  return profiles.find((profile) => profile.assetId === assetId);
}
