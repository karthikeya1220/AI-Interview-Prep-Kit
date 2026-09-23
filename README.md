# AI Interview Prep Kit

Full-stack engineering assessment for Trao. The app turns a pasted job description, company URL, and number of days into an editable interview preparation kit.

## Stack

- Next.js App Router with TypeScript and route handlers
- Tailwind CSS
- MongoDB for users, sessions, kits, and practice records
- LLM via an env-driven provider switch: local **Ollama** (`qwen3:8b`, free, no key, no rate limits — default) or **OpenRouter** cloud free tier (`z-ai/glm-5.2:free` with automatic fallback models), both through the same retry/failover layer
- Cheerio and native `fetch` for lightweight retrieval

I kept frontend and backend in one Next.js app to reduce deployment and operational overhead while still keeping retrieval, generation, validation, scheduling, auth, and persistence separated in `src/lib`.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Required environment variables:

- `LLM_PROVIDER`: `ollama` (local, no key needed) or `openrouter` (cloud). Defaults to `openrouter` when unset; `.env.example` ships with `ollama` so a clean clone runs without a key.
- `OLLAMA_MODEL` / `OLLAMA_FALLBACK_MODELS` / `OLLAMA_BASE_URL`: local models and endpoint used when `LLM_PROVIDER=ollama`; defaults `qwen3:8b`, fallback `llama3.2:3b`, `http://127.0.0.1:11434/v1`.
- `LLM_TIMEOUT_MS`: optional per-request timeout override (defaults: Ollama 180000, OpenRouter 45000).
- `OPENROUTER_API_KEY`: OpenRouter API key (only needed when `LLM_PROVIDER=openrouter`).
- `OPENROUTER_MODEL`: model name, defaults to `z-ai/glm-5.2:free` in code.
- `OPENROUTER_FALLBACK_MODELS`: comma-separated fallback models tried in order when the primary is rate-limited; defaults to `qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free`.
- `OPENROUTER_SITE_URL`: optional OpenRouter ranking header.
- `OPENROUTER_SITE_NAME`: optional OpenRouter ranking header.
- `MONGODB_URI`: MongoDB connection string.
- `SESSION_SECRET`: documented for deployment secret hygiene; session tokens are random and stored hashed.
- `ALLOW_PRIVATE_URLS`: set `true` only for trusted/local evaluation environments.

## Batch Entry Point

```bash
npm run evaluate -- --input cases.json --output kits.json
```

Input shape:

```json
[
  { "id": "case-01", "jd": "Senior Backend Engineer...", "company_url": "http://localhost:8099/acme/", "days": 5 }
]
```

Output follows Appendix B with one entry per case. A failed case is recorded without aborting the run.

## Architecture

- `src/lib/pipeline/run.ts`: orchestrates the full kit generation path used by both UI and batch mode.
- `src/lib/retrieval/company.ts`: validates/fetches company pages, follows relative links, ranks links by about/careers/hiring/interview terms, and records skipped sources.
- `src/lib/llm/openrouter.ts`: provider-agnostic LLM client (Ollama or OpenRouter selected by `LLM_PROVIDER`), JSON-only prompts, model fallback chain, retries with failover across the chain, deterministic fallback generation when no provider is reachable.
- `src/lib/pipeline/coverage.ts`: deterministic must-have coverage check.
- `src/lib/pipeline/schedule.ts`: deterministic schedule allocation.
- `src/lib/validation/kit.ts`: Appendix A structure validation.
- `src/app/api/**/route.ts`: route handlers for auth, kits, regeneration, and practice.

## Retrieval Approach

The company URL is validated before fetch. In production, private and loopback hosts are blocked unless `ALLOW_PRIVATE_URLS=true`. Retrieval accepts HTML/text, strips scripts/styles, caps text size, extracts same-host links, ranks likely about/careers/hiring/interview pages, fetches the top few, and records failures as warnings. robots.txt is fetched once per origin and every subpage fetch is checked against it; blocked pages are skipped and logged. Missing hiring pages are not fatal.

Public interview discussion is searched best-effort (DuckDuckGo HTML) for Glassdoor, Reddit, Blind, Levels.fyi, Indeed, and similar sources. Found URLs are recorded in `research_notes`; when the search is blocked, rate-limited, or empty, the kit records that no public discussion source was found instead of fabricating interview-process evidence.

## Generation Sequence

1. Extract role facts and requirements from the JD.
2. Crawl and clean company pages.
3. Generate a company brief from retrieved source text.
4. Generate questions separately for technical, behavioural, system-design, and company-fit categories.
5. Run deterministic coverage against must-have requirements.
6. Generate missing questions for uncovered must-have requirements.
7. Run coverage again, capped at two passes; a final deterministic sweep still adds a question for any open must-have so kits never ship with uncovered must-haves.
8. Generate flashcards.
9. Allocate the schedule in code.
10. Validate the final kit structure before saving or writing output.

The model is not asked to allocate the schedule or decide final coverage.

## Generated, Edited, and Pinned State

Appendix A fields are preserved exactly. Generated records may also carry:

```ts
meta: { origin: "generated" | "user", edited: boolean, pinned: boolean }
```

When regenerating a question category or the flashcards, user-created, edited, or pinned items are kept and only unedited generated items are replaced.

## Schedule Allocation

The schedule clamps requested days to `1..60`, creates exactly that many day entries, sorts questions so harder and must-have-linked questions land earlier, then distributes questions round-robin. Durations are integer minutes based on question difficulty.

## Creative Feature: Weak Spots Report

The kit sidebar includes a **Weak spots** card (`src/lib/kit/weakSpots.ts`). It merges the deterministic coverage check with practice confidence records into one prioritised list: uncovered must-have requirements and flashcards rated 1/5 are marked bad; uncovered nice-to-haves and cards rated 2/5 are marked warn. Covered requirements and cards rated 3+ are not weak, and unpractised cards are left to practice mode, which already orders them first.

The problem it solves: coverage and practice confidence lived in two different places, so a candidate could see "Coverage clear" and still not know what to spend the next 30 minutes on. The report answers that question in one list, worst first, with a direct link into practice.

## Practice ordering choice

Practice uses a simple confidence-weighted sort: cards rated lower appear first on the next session (ascending by stored confidence, unpractised = 0). We chose this over spaced-repetition intervals because the assessment only needs a defensible “least confident first” rule, scores are already 1–5, and a full SM-2 schedule would need review dates the product does not collect. It is one sort, stable, and easy to explain in a walkthrough.

## Batch budget (5 cases / 15 minutes)

`scripts/evaluate.ts` runs cases with concurrency 2. Free-tier LLM pools rate-limit on tokens-per-minute; two workers keep wall time under the 15-minute budget for five cases while avoiding 429 storms. Each case has its own timeout/fallback chain, and a failed case is recorded without aborting the run.

## Walkthrough video shot list (3–4 minutes)

1. **Create a kit end to end** (~60s) — register/login, paste JD + company URL + days, open the generating checklist.
2. **Research & second pass** (~45s) — show crawl steps, coverage meter, and a must-have that was open then closed after the gap pass (`coverage.passes`).
3. **Edit / reorder / regenerate** (~45s) — edit a question, pin it, regenerate that category; pin/edited items survive.
4. **Practice + schedule** (~45s) — reveal a card, rate 1–5, show least-confident-first order and the day-by-day schedule.
5. **Weak spots + one design decision** (~45s) — Weak spots card; defend deterministic schedule/coverage (never the model).

## Public discussion sources

Best-effort DuckDuckGo HTML search prioritises Glassdoor, Reddit, Blind, Levels.fyi, Indeed, CareerCup, and interview-tagged Stack Overflow. Found URLs are recorded in `research_notes`; the top discussion pages are fetched (when reachable) and fed into company-fit question context. Blocked or empty search is reported honestly, never fabricated.

## Edge Cases

- Invalid or unreachable company URLs produce warnings; a kit can still be generated from the JD.
- Thin JDs produce thin kits using only present text (UI accepts short stubs; no minimum character floor beyond non-empty).
- Missing hiring pages and missing public discussion are recorded honestly.
- Invalid or incomplete model JSON falls back to deterministic generation.
- Provider failures retry (honoring `Retry-After`) across a fallback chain of models, then fall back to deterministic generation, so the batch command remains runnable from a clean clone.
- Free-tier cloud pools rate-limit aggressively (including per-day account quotas); on busy periods some LLM steps may use the deterministic fallback while others use the model. Local Ollama (`LLM_PROVIDER=ollama`) removes this failure mode entirely — no key, no quota, only hardware speed limits.
- Duplicate submissions currently create separate kits; deduplication would be added if product requirements demanded it.
- Crawl requests are spaced (250ms) and every subpage fetch has an 8s timeout; a failed page is recorded as a warning and skipped rather than retried into a longer run.

## Commands

```bash
npm run dev
npm run build
npm run test
npm run lint
npm run evaluate -- --input cases.json --output kits.json
```

## Deployment

**Live URL:** _deploy and paste the public URL here before submitting._

The app is a single Next.js app and deploys anywhere Next.js runs (Vercel, Fly.io, Railway, a container, or a VPS with `npm run build && npm start`).

1. Create a MongoDB Atlas free-tier cluster and copy the connection string.
2. Create an OpenRouter API key at openrouter.ai (free models are supported) — deployed hosts cannot reach a local Ollama, so set `LLM_PROVIDER=openrouter` in production.
3. Set the environment variables from `.env.example` in the hosting provider's dashboard:

   - `MONGODB_URI` — Atlas connection string
   - `LLM_PROVIDER` — `openrouter` for cloud deployments
   - `OPENROUTER_API_KEY` — OpenRouter key
   - `OPENROUTER_MODEL` — optional override, defaults to `z-ai/glm-5.2:free`
   - `OPENROUTER_FALLBACK_MODELS` — optional fallback chain, defaults to `qwen/qwen3.8-27b:free,google/gemma-4-31b-it:free`
   - `SESSION_SECRET` — a long random string
   - `OPENROUTER_SITE_URL` / `OPENROUTER_SITE_NAME` — optional OpenRouter ranking headers

4. Deploy the repo with the provider's Next.js build command (`npm run build`). No extra services are needed; route handlers run inside the same deployment.
5. After deploy, register an account at `/register` and create a kit from `/dashboard`.

The batch command is not part of the deployed app; run it locally or in CI with the same env vars and `npm run evaluate -- --input cases.json --output kits.json`.

## Timeout-Safe Generation

Creating a kit returns `202` immediately with an id. Generation then continues server-side while each pipeline step persists progress and partial results to the kit document. The kit page polls status, shows the completed-step checklist, and if generation fails it displays the error, any preserved partial results, and a Retry button. Client disconnects or timeouts do not lose work; the dashboard shows `Generating…` / `Failed` states.

## Known Limitations

- Generation runs as an in-process background task (fine for a single Node deployment or the evaluator); a queue/worker would be needed for serverless platforms that freeze after the response.
- Section regeneration recomputes the relevant step live and merges with kept items; no response cache, so repeated regeneration costs tokens.
- Public discussion search depends on a third-party HTML endpoint and degrades to an honest "no source found" warning when blocked.
