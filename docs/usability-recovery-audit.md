# Lens usability recovery audit

Audit zachycuje stav commitu `4dfd9d449c6896e998355da44411f85167ca3877` na větvi
`feature/live-market-ux`. Render byl ověřen přes produkční `next build` + `next start`.
Referenční snímky jsou v `test-results/usability-recovery/before/`.

## Produktový závěr

Lens má kvalitní analytické jádro, ale výchozí obrazovka nyní kombinuje portfolio analytics,
správu transakcí, market-data diagnostiku a několik opakovaných interpretací týchž výsledků.
Recovery proto zachovává finanční engine, hero chart, AnalysisContext a Lens Insight a redukuje
rozhodnutí, která uživatel musí dělat předtím, než uvidí portfolio, výkon, důvod a riziko.

## P0 — correctness / blocking

- Personal portfolio používá implicitní `deposit → buy`, ale po `sell` nevytváří odpovídající
  výběr. Prodej proto začne vytvářet syntetickou hotovost, přestože produkt nemá cash-account UX.
- Následující nákup je znovu celý financován externím vkladem; proceeds z prodeje zůstanou jako
  falešná cash pozice. Sekvence buy 100 → sell 120 → buy 80 tedy končí syntetickou hotovostí 120
  před zohledněním poplatků.
- Pořadí transakcí stejného dne závisí na lexikografickém ID. Účetní pravidlo musí explicitně
  garantovat `deposit → buy` a `sell → withdrawal`.

### Rozhodnutí o accounting modelu

Personal portfolio používá **position-ledger mode**. Každý nákup dostane implicitní externí
funding a každý prodej odpovídající implicitní externí withdrawal. Tyto páry jsou pouze
performance-neutral bookkeeping a po provedení obchodu nezanechávají syntetickou cash pozici.
Explicitní uživatelský vklad/výběr, pokud se do ledgeru dostane jinou cestou, zůstává samostatným
cash flow a není neutralizován.

## P1 — major usability

- `Přehled`, `Portfolio` a `Souvislosti` jsou falešná multi-page IA: všechny tři routes renderují
  `DashboardView`. Kanonická destinace bude `/[lang]/dashboard`; staré routes zachovají kompatibilní
  redirect.
- `/assets/[symbol]` funguje jen nad starým hardcoded katalogem, a tím odporuje live universe.
- `PortfolioDrivers` opakuje summary, Contribution a Lens a prodlužuje cestu od grafu k Holdings.
- Market status rozděluje čerstvost, poslední cenu, refresh a provider metadata do příliš mnoha
  míst; footer totéž opakuje.
- Add Investment má tři viditelné kroky a samostatnou review obrazovku pro jedinou transakci.
- Compare vyžaduje otevřít picker a potom druhou akci „Hledat na trhu“ s další search plochou.
- Holdings vždy ukazují search, dva filtry, sort a direction bez ohledu na počet pozic.
- Mobilní tabulka převádí všechny desktopové sloupce na vysoké label/value bloky místo stručného
  přehledu pozice.
- Transaction history nemá disclosure pro více než pět položek.

## P2 — visual polish

- Header současně ukazuje portfolio context, mode badge, market status, refresh a CTA.
- Labely „Portfolio v souvislostech“, „Lokální portfolio“, „Osobní · CZK“, provider footer a
  market strip vytvářejí duplicitní metadata bez nové informace.
- Dotčené komponenty používají několik pozdních CSS override bloků; `lens.css` má před recovery
  57 426 B / 2 709 řádků a 43 výskytů user-facing velikostí 8–9 px.
- Add dialog má 820 px i na jednoduché transaction obrazovce.

## Route audit

- `/[lang]/dashboard`: plný `DashboardView`; vhodný kanonický route.
- `/[lang]/portfolio`: druhý plný `DashboardView`.
- `/[lang]/insights`: třetí plný `DashboardView`.
- `/[lang]/assets/[symbol]`: vyhledává pouze v `assetCatalog`; pro live universe je neúplný a
  hlavní produkt jej nepotřebuje.

## Before metriky

Metriky počítají trvale viditelné rozhodovací prvky, nikoli informační texty nebo ovládání, které
se objeví až po disclosure.

| Metrika | Before | After |
| --- | ---: | ---: |
| Permanentní dashboard sections | 4 (Summary, Hero Analytics, Drivers, Holdings) | 3 (Summary, Hero + Lens, Holdings) |
| Viditelné chart controls | 13 (3 modes, 6 ranges, Compare, Export, Settings, range select) | 13; renderer a analytické volby zachovány, Compare sjednocen do jednoho pickeru |
| Add Investment stages | 3 | 2 (Search/Select, Transaction + inline review) |
| Holdings toolbar controls při 6 pozicích | 6 včetně Add | 3 včetně Add a collapsed Koncentrace |
| Holdings toolbar controls při 30 pozicích | 6 včetně Add | 5 včetně Add a disclosures |
| Přibližná výška mobile holding row | 250–300 px | nejvýše 130 px (automatizovaná kontrola) |
| Top-nav destinations | 4 (3 obsahové + Settings) | 2 (Portfolio + Settings) |

## Recovery hranice

- Beze změny zůstávají PortfolioAnalysis, finance calculations, market providers a cache,
  historical/FX data, SVG chart renderer, AnalysisContext, LensFacts, selected point/range,
  navigator a Contribution/Drawdown matematika.
- Detail koncentrace se přesune do collapsed disclosure u Holdings; výpočet se nemaže.
- Technická diagnostika zůstane v Settings nebo DEV-only inspectorech.
- Nevznikají nové produktové funkce.

## Acceptance focus

Po recovery musí první viewport prioritizovat portfolio value a return, kompaktní summary, hlavní
graf a začátek Lens vysvětlení. Správa instrumentů, transakcí a filtrů se otevře až na vyžádání.

## After ověření

- Osobní ledger vytváří páry `deposit → buy` a `sell → withdrawal`; starší osobní
  obchody se při načtení bezpečně doplní o chybějící implicitní protitok. Explicitní cash flow
  se nemění.
- Kanonický obsahový route je `/[lang]/dashboard`; tři starší routes zachovávají redirect.
- Default dashboard už nerenderuje `PortfolioDrivers`; Koncentrace je collapsed detail u Pozic.
- Add Investment má jednu vyhledávací plochu a jeden transakční formulář s inline náhledem.
- Compare používá jediný searchable picker seskupený na benchmark, portfolio a trh.
- Pozice pod 10 položek nemají search/filter wall; od 10 položek se zpřístupní lokální search
  a jediný disclosure Filtry. Historie nad pět transakcí je zkrácena s volbou zobrazit vše.
- Finální `lens.css` má 56 803 B / 2 621 řádků a 36 výskytů velikostí 8–9 px;
  proti baseline jde o pokles o 623 B, 88 řádků a 7 drobných textových deklarací.
- Obě sady po 13 produkčních snímcích jsou uložené v
  `test-results/usability-recovery/before/` a `test-results/usability-recovery/after/`.
