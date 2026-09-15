# Finanční model P-2_Lens

Jediným vstupem portfolia jsou validované transakce a verzovaná demo data v
`src/data/mock/portfolioDataset.ts`. Pozice, hodnoty, grafy, benchmark i Lens facts se odvozují
funkcemi v `portfolio-engine.ts`.

- Základní měna je CZK. Demo používá pevné kurzy 1 USD = 22,4 CZK a 1 EUR = 24,8 CZK.
- Ceny a kurzy jsou deterministické demo hodnoty, nikoli skutečná tržní historie.
- Demo má denní body pro všechny třídy aktiv. Neimituje burzovní kalendáře; u budoucích reálných
  dat engine použije poslední známý bod, takže víkend krypta a zavřený akciový trh lze spojit bez
  doplňování falešné ceny.
- Pro datum se použije poslední známá cena nejpozději k tomuto dni. Chybějící cena má hodnotu 0 a
  její `assetId` se objeví v `missingPriceAssetIds`; engine cenu nedopočítává.
- Nákup snižuje hotovost, prodej ji zvyšuje a poplatek je zahrnutý do nákladové báze. Prodej
  snižuje agregovanou průměrnou nákladovou bázi poměrně.
- Vklady a výběry jsou externí cash flow. Časová řada výnosu je denně řetězená a tok daného dne
  odečítá před výpočtem výnosu, takže samotný vklad nevypadá jako investiční zisk.
- Osobní portfolio je poziční evidence, nikoli broker cash account: každý nákup dostane
  performance-neutral externí vklad a každý prodej odpovídající externí výběr. Implicitní
  hotovost proto zůstává nulová; samostatně zadané externí cash flow zůstává explicitní.
- Absolutní P/L období je změna hodnoty po odečtení čistých externích toků. Drawdown se počítá z
  časově očištěného indexu, jehož první bod je 100.
- Contribution odpovídá na otázku, které pozice ovlivnily výsledek portfolia. Pro každý den se
  násobí váha aktiva na začátku dne jeho denním CZK výnosem. CZK výnos zahrnuje FX. Nákupy a
  prodeje se považují za události na konci dne, takže nově nakoupené aktivum přispívá od dalšího
  intervalu a prodané aktivum zůstává ve výsledku za dobu, kdy bylo skutečně drženo. Hotovost má
  nulový tržní výnos a zůstává v průměrné alokaci.
- Denní aritmetické příspěvky se agregují za analytické období. Rozdíl proti geometricky řetězenému
  časově očištěnému výnosu je samostatný `residual`. Může zahrnovat skládání, timing transakcí a
  cash-flow, poplatky nebo intervaly přeskočené kvůli chybějící ceně. Residual se nikdy nepřiřadí
  konkrétnímu aktivu jen proto, aby součet uměle souhlasil.
- Koncentrace počítá největší pozici a top 3 z nehotovostních aktiv; hotovost uvádí zvlášť.
  Drawdown používá časově očištěný index a vrací vrchol, dno, obnovu i explicitní stav obnovy.
