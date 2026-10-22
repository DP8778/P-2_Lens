# Audit firemního výzkumu Lens

Výchozí stav: `85f2867036373306a6cf0c43db83fdd897db2bce`, větev
`fix/lens-usability-recovery`. Před implementací ověřen HEAD a přečten contributor
guide, README, research-flow audit, fundamentals/market-data dokumentace,
firemní/Markets komponenty, finanční výpočty a portfolio AI kontrakt/testy.
Původní lokální změna package-lock.json není součástí práce.

## Existující a znovu použitelné

Kanonické členství, URL kontext, datum/verze a návrat z firmy již fungují.
Price chart, Financial Anatomy a finanční přehled jsou deterministické a obsahují
unavailable stavy. Cenová fronta/cache/pokrytí se nemění. FundamentalsSource na
serveru poskytne existující validované výkazy; buildFinancialAnatomy poskytne již
vypočtený růst a marže. Portfolio Lens Insight je nezávislý strukturovaný jazykový
výstup nad ověřeným InsightContext; jeho model, limiter a endpoint zůstávají stejné.

## Chybí

Popis podnikání, aktuální vývoj a zdrojované možnosti/rizika. Doplníme krátké
přechodové texty bez panelů a jeden výzkum právě otevřené akcie. ETF/crypto/cash
výzkum nespouští. Popis firmy bude nad kontextem, události a AI interpretace pod
Financial Anatomy a před vlastní pozicí. Cena ani fundamenty na AI nečekají.

## Hranice

Veškeré Lens metriky zůstávají výstupem finance/data kódu. AI nesmí počítat výnos,
příspěvek, kapitalizaci či marže. Popis podnikání, produkty, smlouvy, regulace,
aktuální události a předpoklady růstu/rizik potřebují webovou citaci. Příležitost
je podmíněná interpretace zdrojů, nikoli předpověď. Chybějící důkazy se přiznají.
Request obsahuje jen striktně validovanou veřejnou identitu a jazyk, žádné portfolio.
Identita známého emitenta se ověří proti snapshotu; jiný listing přes existující
serverový market search. Neznámý/neakciový listing se nepošle do AI.

## Ověření OpenAI integrace

Přečtené aktuální oficiální zdroje:
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/models/gpt-5.5
- https://developers.openai.com/api/docs/guides/structured-outputs

Lokální openai SDK 7.10.0: ResponseOutputText obsahuje text a url_citation
s start_index/end_index/title/url; web_search_call může obsahovat action.sources.
SDK parse přidává parsovaný výstup, ale schéma JSON samo nedokládá vazbu anotací
na jednotlivé dekódované řetězce. Dokumentace nedává záruku této vazby. Proto
nebudeme spoléhat na Structured Outputs + citace uvnitř JSON řetězců.

Jeden responses.create s hosted web_search, include action.sources, store:false,
bez SDK retry; konfigurovatelný gpt-5.5. Text má pět pevně pojmenovaných sekcí,
krátké odstavce a skutečné citace. Normalizátor přijímá pouze odstavce se skutečně
překrývající anotací, URL validuje a deduplikuje. Modelové Markdown/volné URL se
nikdy nestanou odkazy. Strict Zod kontroluje až normalizovanou reprezentaci.
Publikační data nejsou v citačním kontraktu: nevymýšlet je. Datum události lze
zobrazit pouze jako zdrojovaný text, odlišně od serverového data výzkumu.

## Náklady a degradace

Samostatný přísnější paměťový limiter je pouze prototypová ochrana jedné instance,
ne trvalý distribuovaný limit. Browser session cache identity+jazyk na 45 minut,
single-flight proti React opakování; manuální Obnovit obejde čerstvost cache.
Při selhání se zachová poslední validovaný výzkum s původním časem. Bez klíče,
při rate limitu či bez použitelných důkazů řízený stav, žádný vymyšlený fallback.
Žádné přednačítání tabulek/univerz, žádný další news crawler či databáze.

Automatické testy budou mockovat OpenAI a transport, včetně citací, malformovaných
výstupů, citlivých klíčů, cache/refreshe, neakciových aktiv a mobilního round tripu.
Živý placený OpenAI požadavek není součástí tohoto ověření.
