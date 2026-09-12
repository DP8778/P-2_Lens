# Contextual Lens Insight

Aktivní Lens používá jediný tok dat:

1. `PortfolioAnalysis` vypočítá finanční hodnoty.
2. `toLensFacts` vytvoří validovaný, PII-free výběr faktů.
3. `buildInsightContext` zvolí scope a focus podle trvalého `AnalysisContext`.
4. `buildDeterministicInsight` okamžitě vytvoří plnohodnotnou strukturovanou odpověď.
5. Volitelná AI vrstva smí upravit pouze krátké české formulace a musí odkazovat na existující
   evidence ID. Čísla a akce zůstávají ve vlastnictví aplikace.

Analytický scope má přednost v tomto pořadí: explicitní `selectedRange`, timeframe a celkový
přehled. Uvnitř scope se volí focus: trvalý `selectedPoint`, vybrané aktivum, aktuální režim a
obecný přehled. Hover se do kontextu neposílá.

Klient zobrazí deterministic odpověď bez čekání. Síťový požadavek je debounceovaný, rušený přes
`AbortController`, chráněný verzí kontextu a cacheovaný podle datasetu a trvalého výběru. Selhání
endpointu proto neodstraní finanční fakta ani vysvětlení z UI.
