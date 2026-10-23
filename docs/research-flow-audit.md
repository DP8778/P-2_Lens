# Audit návaznosti průzkumu Markets → firma

Výchozí stav: `5586a04c0610e8dd5f1ef947babaccf988559aff`, větev
`fix/lens-usability-recovery`. Existující lokální změna `package-lock.json` není
součástí sprintu.

## Již funguje — zachovat

- Serverový ověřený FundamentalsSource poskytuje verzované členství, kapitalizace,
  roční výkazy, zdroje a vyřazené kandidáty. Počty ve snapshotu: AI 60,
  AI Infrastructure 38, Semiconductors 49, SaaS/Cloud 33, Cybersecurity 23.
- ThemeDetail používá celé vybrané univerzum; roční historie se načte přes společnou
  frontu s cache, aborty, retry a rate-limit cooldown. Období se odvozují lokálně.
- Výnosy mají pravidlo alespoň 80 % a alespoň min(10,N) společností. Indexy zachovávají
  pevné počáteční váhy; srovnání vyžaduje totožné firmy i data.
- Loading/insufficient/ready fungují bez falešných metrik; treemap je nezávislá.
- URL kontrakt validuje identifikátory, období, vážení, datum a verzi, nepřenáší
  finanční hodnoty. Kontext firmy čte pouze uloženou historii; změnu verze přiznává.
- Financial Anatomy má ověřené výkazy, marže, historii, zdroje i unavailable stav.

## Nutné změny prezentace a navigace

- MarketPulse na Dashboardu vydává denní průměr 4 kompatibilních akcií za výkon
  stejného tématu, jehož detail používá kanonické univerzum. Plné Markets navíc
  stále zobrazují tento koš a zbytečně načítají jeho quotes. Nahradit teaser
  metadaty ze snapshotu a odstranit koš i quote efekt.
- Vybrané téma/období/vážení jsou lokální stav; viditelná URL se neaktualizuje.
  Použít dokumentované native History API propojené s App Router useSearchParams.
  Pro změny pohledu použít replaceState (jedna položka průzkumu v historii), pro
  vstup do firmy normální Link. URL se stane zdrojem stavu, bez zapisovacího efektu.
- Terminologie: kategorie je „Téma“, soubor členů „Univerzum Lens“, vývoj „Lens
  Pulse“, výpočet „Index 100“. Anglicky Theme / Lens universe / Lens Pulse.
  „Až 100 způsobilých firem s US listingem“ patří do metodiky, nikoli do jmenovatele.
- Vysvětlit počáteční stejné versus kapitalizační váhy a označit aktivní pohled,
  který řídí hlavní výnos i příspěvky. Dvě čáry zůstávají srovnáním.
- Zviditelnit jmenovatele tržeb/růstu a datum výkazů; žádná extrapolace.
- Hlavní návrat z firmy vede na vybrané téma, price chart převezme období.
  Kontext potichu přizná datum/verzi. Přímý vstup na firmu funguje dál.
- Krátký finanční souhrn lze sestavit z existujících deterministicky odvozených
  marží, růstu a fiskálního období; při nedostatku údajů se vynechá.
- Mobil: odstranit 3 stísněné sloupce účasti, zvětšit drobné popisky, omezit mapu.
  Desktop loading 620 px nahradit menším statickým prostorem bez shimmer animace.

## Ověření

Aktualizovat sémantické testy původního koše (jeho odstranění je záměrná změna),
URL a round trip, coverage/freshness a mobil. Zachovat regresní finance/cache testy.
Spustit lint, typecheck, Jest, build a relevantní Playwright s deterministickým
transportem na 1440 × 1000 i 390 × 844. Žádný automatizovaný test nepoužije živé API.

## Realizace a hranice

- Dashboard dostává ze serverového snapshotu pouze počty a metadata členství,
  nenačítá cenová data témat. Markets vůbec nerenderuje kompatibilní čtyřakciový koš.
- Native `replaceState` je dokumentovaný Next 16 postup pro lokální změny query;
  `useSearchParams` je zdroj stavu plného Markets. Finanční výsledky v URL nejsou.
  Změna tématu zachová období, vážení a asOf a použije verzi nového univerza.
- Odkaz na starší verzi členství není archivní index. Markets přizná použití nynější
  verze, kontext firmy s neodpovídající verzí nezobrazí původní výnos/příspěvek.
- Price chart firmy převezme období, ale dál používá existující aktuální cenovou
  historii. Kontext tématu samostatně respektuje asOf a denní uzavřené ceny. Proto
  návštěva AMD může doplnit jeden vlastní aktuální den; neznovunačítá univerzum.
- Původní testy požadující quote request čtyřčlenného koše byly záměrně nahrazeny
  kontrolou kanonických počtů a nulového requestu z discovery. Starý rozměrový test
  rezervace 620 px byl nahrazen kontrolou omezené loading výšky a mobilní čitelnosti.
- Krátký Financial Anatomy souhrn pouze formátuje existující finance výstup.
  Zdrojové fundamenty, členství, výpočty, queue, cache ani retry se nemění.

## Změněné soubory sprintu

- `docs/research-flow-audit.md`
- `src/app/[lang]/dashboard/page.tsx`
- `src/app/[lang]/markets/page.tsx`
- `src/components/assets/AssetDetailView.tsx`
- `src/components/assets/AssetIndustryContext.tsx`
- `src/components/assets/FinancialAnatomy.tsx`
- `src/components/dashboard/DashboardView.tsx`
- `src/components/markets/IndustryCompanies.tsx`
- `src/components/markets/IndustryMarketMap.tsx`
- `src/components/markets/IndustryVisualizations.tsx`
- `src/components/markets/MarketPulse.tsx`
- `src/components/markets/ThemeDetail.tsx`
- `src/components/markets/ThemeHistoryChart.tsx`
- `src/data/industry-sources.md`
- `src/lib/finance/industry-pulse.ts`
- `src/styles/lens.css`
- `tests/e2e/fixtures/research-market.ts`
- `tests/e2e/industry-pulse-states.spec.ts`
- `tests/e2e/market-pulse-and-performance.spec.ts`
- `tests/e2e/research-roundtrip.spec.ts`
- `tests/integration/industry-context.test.tsx`
- `tests/integration/industry-navigation.test.tsx`
- `tests/integration/industry-performance-coverage.test.tsx`
- `tests/integration/top-industry-detail.test.tsx`
- `tests/unit/financial-anatomy.test.tsx`
- `tests/unit/industry-overview-strip.test.tsx`
- `tests/unit/market-pulse.test.tsx`
- `tests/unit/theme-detail.test.tsx`

## Závěrečné ověření 2026-10-04

- `npm run lint` — prošlo bez chyb a varování.
- `npm run typecheck` — prošlo.
- `npm test -- --runInBand` — 43 sad, 219 úspěšných testů, 1 existující TODO.
- `npm run build` — produkční sestavení prošlo.
- `npx playwright test --config=/tmp/lens-research-playwright.config.cjs industry-pulse-states.spec.ts market-pulse-and-performance.spec.ts research-roundtrip.spec.ts` — 5/5 prošlo.

Lokální Playwright konfigurace používá nainstalovaný Chrome, jeden worker,
`http://localhost:3000` a ukládá výstupy do `/tmp/lens-research-e2e-results`.
Testy v repozitáři nevyžadují Chrome channel; běžná CI konfigurace používá Chromium.
Ověřeno 1440 × 1000 a 390 × 844: nulový vodorovný overflow stránky,
jednosloupcová účast firem, 300px mobilní mapa, loading13/49 →21/49 →ready,
reduced motion, URL/refresh/AMD/návrat. Vizuály cen jsou deterministické transportní
fixtures; testy nepoužívají živé veřejné API. Neupravované poskytovatele a queue
nadále ověřuje celá Jest sada. Žádný commit, push, merge ani rebase.
