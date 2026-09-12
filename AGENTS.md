# P-2_Lens contributor guide

- Product copy and reports are Czech-first; code identifiers and filenames are English.
- Financial values must originate in `src/lib/finance`, never in the LLM.
- AI payloads must stay structured, validated, PII-free, and server-side.
- Keep mock data deterministic and clearly labelled.
- Preserve accessible text summaries for every chart and never encode status with color alone.
- Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before a commit.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
