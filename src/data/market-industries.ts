import { marketThemeAssets, type MarketTheme } from "./market-themes";
import type { MarketAsset } from "@/lib/market-data/types";

// Curated thematic membership, not an exhaustive sector classification or index membership.
// Reference lists: Global X AIQ/CLOU and First Trust CIBR; see industry-sources.md.
// Nasdaq market categories verified against nasdaqlisted.txt (2026-09-25).
// NYSE listings use XNYS; country is omitted rather than inferred from exchange.
const listed = (symbol: string, name: string, exchange: "NASDAQ" | "NYSE", micCode = exchange === "NYSE" ? "XNYS" : "XNGS"): MarketAsset => ({
  id: `twelvedata:${micCode}:${symbol}`, provider: "twelvedata", providerSymbol: symbol,
  symbol, name, type: "stock", exchange, micCode, currency: "USD",
});
const additional: Record<string, MarketAsset> = {
  AAOI: listed("AAOI", "Applied Optoelectronics, Inc.", "NASDAQ", "XNGM"),
  ADBE: listed("ADBE", "Adobe Inc.", "NASDAQ"),
  ADI: listed("ADI", "Analog Devices, Inc.", "NASDAQ"),
  AI: listed("AI", "C3.ai, Inc.", "NYSE"),
  AIP: listed("AIP", "Arteris, Inc.", "NASDAQ", "XNGM"),
  AKAM: listed("AKAM", "Akamai Technologies, Inc.", "NASDAQ"),
  ALAB: listed("ALAB", "Astera Labs, Inc.", "NASDAQ"),
  AMBA: listed("AMBA", "Ambarella, Inc.", "NASDAQ"),
  AMKR: listed("AMKR", "Amkor Technology, Inc.", "NASDAQ"),
  ARM: listed("ARM", "Arm Holdings plc", "NASDAQ"),
  BB: listed("BB", "BlackBerry Limited", "NYSE"),
  BBAI: listed("BBAI", "BigBear.ai Holdings, Inc.", "NYSE"),
  BOX: listed("BOX", "Box, Inc.", "NYSE"),
  CEVA: listed("CEVA", "CEVA, Inc.", "NASDAQ"),
  CHKP: listed("CHKP", "Check Point Software Technologies Ltd.", "NASDAQ"),
  CLS: listed("CLS", "Celestica Inc.", "NYSE"),
  COHR: listed("COHR", "Coherent Corp.", "NYSE"),
  CRDO: listed("CRDO", "Credo Technology Group Holding Ltd", "NASDAQ"),
  CSCO: listed("CSCO", "Cisco Systems, Inc.", "NASDAQ"),
  CVLT: listed("CVLT", "Commvault Systems, Inc.", "NASDAQ"),
  DDOG: listed("DDOG", "Datadog, Inc.", "NASDAQ"),
  DELL: listed("DELL", "Dell Technologies Inc.", "NYSE"),
  DOCN: listed("DOCN", "DigitalOcean Holdings, Inc.", "NYSE"),
  ESTC: listed("ESTC", "Elastic N.V.", "NYSE"),
  FFIV: listed("FFIV", "F5, Inc.", "NASDAQ"),
  FIVN: listed("FIVN", "Five9, Inc.", "NASDAQ", "XNGM"),
  FROG: listed("FROG", "JFrog Ltd.", "NASDAQ"),
  GEN: listed("GEN", "Gen Digital Inc.", "NASDAQ"),
  GFS: listed("GFS", "GLOBALFOUNDRIES Inc.", "NASDAQ"),
  GTLB: listed("GTLB", "GitLab Inc.", "NASDAQ"),
  HPE: listed("HPE", "Hewlett Packard Enterprise Company", "NYSE"),
  IBM: listed("IBM", "International Business Machines Corporation", "NYSE"),
  INOD: listed("INOD", "Innodata Inc.", "NASDAQ", "XNGM"),
  INTC: listed("INTC", "Intel Corporation", "NASDAQ"),
  LITE: listed("LITE", "Lumentum Holdings Inc.", "NASDAQ"),
  LSCC: listed("LSCC", "Lattice Semiconductor Corporation", "NASDAQ"),
  MDB: listed("MDB", "MongoDB, Inc.", "NASDAQ", "XNGM"),
  MRVL: listed("MRVL", "Marvell Technology, Inc.", "NASDAQ"),
  MU: listed("MU", "Micron Technology, Inc.", "NASDAQ"),
  NET: listed("NET", "Cloudflare, Inc.", "NYSE"),
  NTAP: listed("NTAP", "NetApp, Inc.", "NASDAQ"),
  NVTS: listed("NVTS", "Navitas Semiconductor Corporation", "NASDAQ", "XNGM"),
  NXPI: listed("NXPI", "NXP Semiconductors N.V.", "NASDAQ"),
  OKTA: listed("OKTA", "Okta, Inc.", "NASDAQ"),
  ON: listed("ON", "ON Semiconductor Corporation", "NASDAQ"),
  ORCL: listed("ORCL", "Oracle Corporation", "NYSE"),
  PATH: listed("PATH", "UiPath, Inc.", "NYSE"),
  QCOM: listed("QCOM", "QUALCOMM Incorporated", "NASDAQ"),
  QLYS: listed("QLYS", "Qualys, Inc.", "NASDAQ"),
  RBRK: listed("RBRK", "Rubrik, Inc.", "NYSE"),
  RDWR: listed("RDWR", "Radware Ltd.", "NASDAQ"),
  RPD: listed("RPD", "Rapid7, Inc.", "NASDAQ", "XNGM"),
  S: listed("S", "SentinelOne, Inc.", "NYSE"),
  SMCI: listed("SMCI", "Super Micro Computer, Inc.", "NASDAQ"),
  SOUN: listed("SOUN", "SoundHound AI, Inc.", "NASDAQ", "XNGM"),
  TEAM: listed("TEAM", "Atlassian Corporation", "NASDAQ"),
  TENB: listed("TENB", "Tenable Holdings, Inc.", "NASDAQ"),
  TLS: listed("TLS", "Telos Corporation", "NASDAQ", "XNGM"),
  TXN: listed("TXN", "Texas Instruments Incorporated", "NASDAQ"),
  VRNS: listed("VRNS", "Varonis Systems, Inc.", "NASDAQ"),
  WDAY: listed("WDAY", "Workday, Inc.", "NASDAQ"),
  ZETA: listed("ZETA", "Zeta Global Holdings Corp.", "NYSE"),
};
const companies = new Map([...marketThemeAssets, ...Object.values(additional)].map((asset) => [asset.symbol, asset]));
const universes: Record<string, string[]> = {
  "ai": ["NVDA", "PLTR", "MSFT", "GOOGL", "AMD", "ORCL", "IBM", "CRM", "NOW", "SNOW", "PATH", "SOUN", "AI", "BBAI", "INOD", "ZETA", "ADBE", "DDOG"],
  "ai-infrastructure": ["NVDA", "AVGO", "AMD", "ANET", "DELL", "HPE", "SMCI", "CRDO", "ALAB", "AAOI", "NTAP", "CLS", "LITE", "COHR", "CSCO", "DOCN", "NVTS", "RDWR"],
  "semiconductors": ["NVDA", "AMD", "AVGO", "TSM", "MU", "INTC", "QCOM", "TXN", "ADI", "ARM", "MRVL", "NXPI", "ON", "GFS", "LSCC", "AMBA", "CEVA", "AIP", "NVTS", "AMKR"],
  "saas-cloud": ["MSFT", "CRM", "NOW", "SNOW", "DDOG", "MDB", "TEAM", "WDAY", "ADBE", "GTLB", "FROG", "DOCN", "ESTC", "BOX", "FIVN", "ZETA", "PATH", "AI"],
  "cybersecurity": ["CRWD", "PANW", "FTNT", "ZS", "NET", "OKTA", "S", "TENB", "RPD", "QLYS", "VRNS", "RDWR", "CHKP", "GEN", "BB", "TLS", "FFIV", "AKAM", "RBRK", "CVLT"],
};
export const industryDescriptions: Record<string, string> = {
  ai: "AI platformy, podnikový software, automatizace a specializované modely.",
  "ai-infrastructure": "Výpočetní hardware, servery, sítě, optické propojení a datová infrastruktura.",
  semiconductors: "Návrh čipů, výroba, paměti, analogové obvody a pouzdření.",
  "saas-cloud": "Podnikové aplikace, cloudové platformy, databáze a vývojářské nástroje.",
  cybersecurity: "Ochrana sítí, identit, koncových zařízení, dat a bezpečnostní analytika.",
};
export function industryCompanies(theme: MarketTheme): MarketAsset[] {
  return (universes[theme.id] ?? theme.constituents.map((asset) => asset.symbol)).map((symbol) => companies.get(symbol)!).filter(Boolean);
}
