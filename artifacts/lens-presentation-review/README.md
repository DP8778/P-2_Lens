# Lens presentation review

Screenshot metadata for the deterministic browser review performed on 2026-10-22.

| Screenshot | Viewport | Data mode and source | Cutoff / state |
| --- | --- | --- | --- |
| `01-portfolio-contributions-evidence.png` | 1440 × 1000 | Demo portfolio, `lens-demo-2026.09-v2`; application-computed Evidence; AI transport intentionally unavailable | Data through 2026-09-07; 1Y, Contributions, NVDA selected, Evidence open |
| `02-demo-nvidia-financial-anatomy.png` | 1440 × 1000 | Demo price/history/position plus separately sourced snapshot statements | Demo data through 2026-09-07; NVIDIA detail and demo provenance |
| `03-markets-semiconductors.png` | 1440 × 1000 | Deterministic Twelve Data-compatible browser fixture; canonical snapshot membership | Data through 2026-10-04; Semiconductors, 3M, market-cap weighting |
| `04-amd-theme-context.png` | 1440 × 1000 | Same deterministic market fixture plus separately sourced snapshot statements | AMD opened from Semiconductors with exact 3M/market-cap/as-of/version context |
| `05-nvidia-statements-without-prices.png` | 1440 × 1000 | Price provider deliberately unavailable; canonical identity and snapshot statements retained | Explicit unavailable-price and unavailable-history states |
| `06-touch-navigation.png` | 390 × 844 | Demo portfolio, deterministic local dataset | Touch header with Portfolio, Markets, search and settings available |

These files are review artifacts, not production market data. The corresponding automated flow is `tests/e2e/lens-presentation-review.spec.ts`.

