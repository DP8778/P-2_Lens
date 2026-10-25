const filing = "https://www.sec.gov/Archives/edgar/data/1671933/000167193326000014/ttd-20251231.htm";
/** Reviewed observations, separate from live research and financial calculations. */
export const advertisingContext = {
  reviewedAt: "2026-10-25",
  market: {
    value: 294_600_000_000, currency: "USD", year: 2025,
    scope: { "cs-CZ": "USA · výnosy z internetové reklamy", "en-US": "US · internet advertising revenue" },
    source: "https://www.iab.com/wp-content/uploads/2026/04/IAB_PwC_Internet_Ad_Revenue_Report_Full_Year_2025_April_2026.pdf",
    publishedAt: "2026-04-16", status: "industry-estimate",
    limitation: { "cs-CZ": "Širší měřítko reklamního trhu podle IAB/PwC. Jde o americké výnosy prodejců reklamy, zatímco TTD vykazuje globální netto tržby a globální gross spend. Číslo není velikostí trhu DSP ani jmenovatelem podílu TTD.", "en-US": "Broader IAB/PwC industry estimate of US ad sellers’ revenue. TTD reports global net revenue and gross spend. This is neither DSP market size nor a denominator for TTD market share." },
  },
  competitors: [
    { name: "The Trade Desk", source: filing, description: { "cs-CZ": "DSP pro agentury a inzerenty. Nákup napříč vydavateli; výnosy z platformy, služeb a dat. Sama není vlastníkem velkého reklamního média.", "en-US": "DSP for agencies and advertisers across publishers. Platform, service and data revenue; not a major owned-media seller." } },
    { name: "Google Display & Video 360", source: "https://marketingplatform.google.com/about/display-video-360/", description: { "cs-CZ": "Nákupní platforma v širším reklamním ekosystému Googlu. Zahrnuje přístup k YouTube a propojení s dalšími nástroji; nelze porovnávat celé tržby Googlu s tržbami TTD.", "en-US": "Buying platform in Google’s broader ad ecosystem, with YouTube access and connected tools. Total Google revenue is not comparable to TTD revenue." } },
    { name: "Amazon Ads · DSP", source: "https://advertising.amazon.com/solutions/products/amazon-dsp", description: { "cs-CZ": "Programatický nákup Amazonu propojuje vlastní signály s prostorem na Amazonu i mimo něj. Amazon nyní začleňuje DSP do Ads Agent; retailová data a vlastní média dávají modelu jiný základ.", "en-US": "Amazon’s programmatic buying combines its signals with on- and off-Amazon inventory. DSP is now part of Ads Agent; retail data and owned media create a different base." } },
  ],
  watchouts: [
    { kind: { "cs-CZ": "Tvrzení vedení · FY2025", "en-US": "Management claim · FY2025" }, label: { "cs-CZ": "CTV a hodnotnější služby", "en-US": "CTV and higher-value services" }, text: { "cs-CZ": "Vedení spojuje další růst s CTV, Kokai a datovými službami. Jde o strategii firmy; výkaz neposkytuje samostatné tržby těchto produktů.", "en-US": "Management links growth to CTV, Kokai and data services. These are strategic claims, not separately reported product revenues." }, source: filing },
    { kind: { "cs-CZ": "Zdrojované riziko · 10-K", "en-US": "Reported risk · 10-K" }, label: { "cs-CZ": "Rozpočty, přístup k datům a konkurence", "en-US": "Budgets, data access and competition" }, text: { "cs-CZ": "Výroční zpráva uvádí citlivost na výdaje inzerentů, změny soukromí a identifikace uživatelů i konkurenci velkých platforem. Dostupnost kvalitního prostoru a dat není pod plnou kontrolou TTD.", "en-US": "The filing identifies advertiser spending, privacy and identity changes, and large-platform competition as risks. Inventory and data access are not fully controlled by TTD." }, source: filing },
    { kind: { "cs-CZ": "Interpretace Lens", "en-US": "Lens interpretation" }, label: { "cs-CZ": "Sledovat objem i ekonomiku", "en-US": "Watch volume and economics" }, text: { "cs-CZ": "Růst gross spend sám nestačí. Vedle něj sleduji netto tržby, jejich poměr k objemu a provozní náklady. Vyšší poměr může odrážet mix služeb i účetní prezentaci, nikoli jen zdražení.", "en-US": "Gross spend growth alone is insufficient. Compare net revenue, the revenue-to-spend ratio and operating costs. A higher ratio can reflect service mix and accounting presentation, not just pricing." }, source: filing },
  ],
} as const;
