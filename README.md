# P-2_Lens

> “Data are available. Understanding them is the harder problem.”

P-2_Lens je portfolio-grade prototyp, který odpovídá na otázku „Co se s portfoliem stalo a proč?“. Finanční vrstva nejprve deterministicky vypočítá výkon, příspěvky, expozice a drawdown. Až potom může vysvětlující AI převést hotové metriky do krátkého textu s dohledatelnými důkazy.

## Product hypothesis

Běžné portfolio nástroje ukazují mnoho čísel, ale nechávají porozumění na uživateli. Lens staví hierarchii od výsledku přes hlavní hybatele a rizika až po detail jednotlivé pozice. AI není zdrojem finančních hodnot.

## Portfolio case-study angle

- Data visualization: jeden hlavní výkonový graf, následovaný drivers, alokací a rizikem.
- AI explanation layer: strukturovaný Responses API výstup nad předem vypočítanými metrikami.
- Trust/evidence: každé tvrzení lze rozbalit až na zdrojovou metriku.
- Error states: loading, rate limit, chyba a deterministický fallback.
- Accessibility: význam změny vyjadřují znaménka, popisky a ikony; grafy mají textové souhrny.
- Privacy: AI payload neobsahuje e-mail, účet, credentials, volné poznámky ani celý holdings objekt.

## Tech stack

Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, Recharts, OpenAI JavaScript SDK, Zod, Jest + Testing Library, Playwright a Storybook 10.

## Requirements

- Node.js 24 LTS (`.nvmrc`)
- npm 11+

## Installation

```powershell
nvm use 24
npm install
Copy-Item .env.example .env.local
npm run dev
```

Aplikace poběží na `http://localhost:3000` a přesměruje na české demo přihlášení. `OPENAI_API_KEY` může zůstat prázdný.

## Scripts

| Příkaz                                    | Účel                             |
| ----------------------------------------- | -------------------------------- |
| `npm run dev`                             | Lokální Next.js server           |
| `npm run build` / `npm start`             | Produkční sestavení a server     |
| `npm run lint` / `npm run lint:fix`       | ESLint kontrola / oprava         |
| `npm run typecheck`                       | TypeScript bez emitování         |
| `npm test` / `npm run test:watch`         | Jest testy                       |
| `npm run test:e2e`                        | Produkční build + Playwright E2E |
| `npm run storybook`                       | Storybook na portu 6006          |
| `npm run build-storybook`                 | Statický Storybook build         |
| `npm run format` / `npm run format:check` | Prettier                         |

## Environment variables

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
```

Obě proměnné jsou pouze server-side. Nikdy nepoužívejte prefix `NEXT_PUBLIC_` pro API klíč a necommitujte `.env.local`.

## Architecture

- `src/app`: locale routes a serverové API endpointy.
- `src/components`: malý design system, layout a doménové komponenty.
- `src/data/mock`: stabilní portfolio, ceny a časové řady bez `Math.random()`.
- `src/lib/finance`: čisté deterministické výpočty.
- `src/lib/ai`: bezpečná redukce payloadu, fallback a limiter.
- `src/lib/repositories`: rozhraní `MarketDataProvider` a mock implementace.
- `src/i18n`: český a anglický slovník; formátování zůstává oddělené.

## Routes

- `/cs-CZ/login` — demo autentizace
- `/cs-CZ/dashboard` — hlavní analytický přehled
- `/cs-CZ/portfolio` — filtrování a řazení pozic
- `/cs-CZ/assets/[symbol]` — detail BTC, NVDA, SPY, AAPL, NVO nebo USD
- `/cs-CZ/insights` — lokální mock historie
- `/cs-CZ/settings` — locale, měna, vysvětlení, soukromí a vzhled
- stejné routy pod `/en-US`
- `GET /api/market/bitcoin`
- `POST /api/ai/portfolio-insight`

## Financial calculation layer

`calculateReturn`, `calculateContribution`, `calculateAllocation`, `calculateMaxDrawdown` a `buildPortfolioMetrics` jsou čisté funkce a mají unit testy. API pro insight přijímá pouze jejich výstup zmenšený na Zod-validovaný kontrakt. Model nic nepřepočítává.

## Mock market data

`MockMarketDataProvider` vrací stabilní BTC quote a časovou řadu. Instrumenty používají známé tickery pouze jako demo označení; ceny nejsou aktuální. Pozdější `LiveMarketDataProvider` může implementovat stejné rozhraní bez změny chartů.

## AI architecture

Endpoint validuje velikost i tvar requestu, aplikuje jednoduchý anti-spam limit a volá server-side OpenAI Responses API se strukturovaným Zod outputem. Timeout je 12 sekund a SDK má jeden omezený retry. Stav 429 se mapuje na lidský text a `Retry-After`; raw upstream chyby se klientovi neposílají. Bez klíče nebo při neplatném outputu se shrnutí sestaví programově z dodaných čísel.

## AI trust and limitations

Každý driver a watchout nese `metricReference`, který UI zpřístupní jako evidence. AI smí hodnoty vysvětlit a porovnat, nesmí doporučit nákup/prodej ani předpovídat cenu. Výstup je označený jako AI nebo demo a vždy uvádí, že nejde o investiční doporučení.

In-memory limiter je vhodný pouze pro lokální prototyp. V distribuované produkci by vyžadoval sdílené úložiště a identitu uživatele.

## Accessibility

Cíl je WCAG 2.2 AA: sémantická struktura, viditelný focus, ovládání klávesnicí, dostatečné cíle, textové chart summaries, `aria-live` pro generování a stav komunikovaný ikonou, znaménkem i textem.

## i18n

Výchozí locale je `cs-CZ`, druhé `en-US`. Copy žije v JSON slovnících; měny, procenta a data formátuje samostatná `Intl` vrstva. Prototyp překládá navigaci a hlavní dashboard; některý hlubší demo obsah zůstává záměrně česky jako produkční mezera.

## Analytics

Typed `track()` dovoluje pouze schválené názvy událostí a bezpečné atributy jako timeframe, symbol či typ filtru. Zakazuje konstrukcí raw holdings, prompty, API odpovědi, klíče a PII. V prototypu pouze vypisuje události v development režimu.

## Testing

Jest ověřuje finance, formátování, AI schemas, fallback, základní komponenty a API bez klíče. Playwright pokrývá demo login, změnu období, BTC detail a insight flow. CI nevyžaduje skutečný OpenAI klíč.

## Figma round-trip workflow

1. Spusťte `npm run dev` a nastavte viewport 1440 × 1024.
2. Zachyťte stabilní routy pomocí Figma capture nástroje; DOM používá Grid/Flex a centralizované tokeny.
3. Pojmenujte frames například `P-2 Lens / Dashboard / Desktop / 1M`, `P-2 Lens / Dashboard / Desktop / AI Insight`, `P-2 Lens / Portfolio / Desktop / Default`.
4. Komponenty mapujte jako `Navigation/Sidebar`, `Metric/Card`, `Chart/Performance`, `Portfolio/AssetRow`, `AI/InsightCard` a `Status/DataQuality`.
5. Pro insight varianty použijte Storybook, kde jsou stavy deterministické a izolované.

## Production gaps

- Portfolio i historie jsou mock; chybí skutečné broker napojení.
- Přihlášení je pouze demo bez identity a session.
- Ceny nejsou živá tržní data.
- AI historie se trvale neukládá.
- Limiter je pouze in-memory a není vhodný pro distribuované nasazení.
- Produkt neposkytuje finanční poradenství.
- Preference a consent nejsou perzistentní.

## Onboarding checklist

- [ ] Používá se Node 24 LTS
- [ ] `npm install` dokončen
- [ ] `.env.local` vytvořen z `.env.example`
- [ ] Demo funguje bez `OPENAI_API_KEY`
- [ ] `npm run dev` funguje
- [ ] `npm run lint` prochází
- [ ] `npm run typecheck` prochází
- [ ] `npm test` prochází
- [ ] `npm run build` prochází
- [ ] `npm run storybook` funguje
- [ ] `npm run test:e2e` prochází
- [ ] Figma round-trip workflow je přečtený

## First commit

```powershell
git init
git add .
git commit -m "feat: scaffold p-2 lens portfolio intelligence dashboard"
```
