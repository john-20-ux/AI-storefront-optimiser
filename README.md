# AI Storefront Optimizer

A Shopify embedded app that scans a merchant's catalog, scores each product 0–100 on
**AI/search readiness**, surfaces issues, generates AI-powered fixes (titles, descriptions,
SEO, image alt text, tags), and applies merchant-approved changes back to Shopify — field by field.

Built on the official Shopify React Router app template with Polaris web components,
Prisma + Postgres, and Anthropic Claude.

## What it does

1. **Scan** — fetches products on demand via the GraphQL Admin API (no raw catalog data is stored).
2. **Score** — a pure, rule-based engine rates seven dimensions (title, description, SEO, image,
   taxonomy, variant, trust) for a 0–100 readiness score with issue codes. See `app/scoring/`.
3. **Generate** — each merchant connects **their own AI** (Anthropic, OpenAI, or OpenRouter) via
   a paste-a-key form or a one-click **OpenRouter OAuth (PKCE)** flow. Keys are encrypted at rest
   (AES-256-GCM). Suggestions are generated on demand; rule-based checks run first to keep cost low.
   See `app/ai/` and `app/lib/aiConnection.server.ts`.
4. **Apply** — selected-field-only updates via `productUpdate` / `fileUpdate`, single or bulk,
   with before/after review. See `app/shopify/mutations.ts`.
5. **Export & billing** — CSV export and Shopify Billing (Free / Starter $9 / Growth $29 / Pro $79).

## Data policy

Only sessions, shop metadata, scan settings, and aggregate scan summaries are persisted
(`prisma/schema.prisma`). Product titles, descriptions, images, customer, and order data are
**never** stored. Scopes: `read_products, write_products, read_files, write_files`.

## Local development

Prerequisites: Node ≥ 20, a Shopify Partner account + development store, and a Postgres database.
Merchants supply their own AI keys in-app, so no provider key is required to run the app — but you
must set an `ENCRYPTION_KEY` (used to encrypt those keys at rest).

```bash
npm install
cp .env.example .env        # fill DATABASE_URL + ENCRYPTION_KEY (Shopify vars set by the CLI)
# generate an ENCRYPTION_KEY:
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npx prisma migrate dev      # create the schema
npm run dev                 # shopify app dev — installs on your dev store
```

Merchants then open **Settings → AI connection** to connect Anthropic/OpenAI (paste key) or
OpenRouter (OAuth). The OpenRouter callback is served at `/openrouter/callback`.

Useful scripts:

```bash
npm run test        # vitest — scoring engine unit tests
npm run typecheck   # react-router typegen + tsc
npm run build       # production build
```

## Testing

Run the full suite (unit + integration + route tests) with Vitest:

```bash
npm test
```

Layers:
- **Unit** — scoring engine, crypto, OAuth-security helpers, AI provider/model logic, prompts, CSV, plans.
- **Integration (real Postgres)** — encrypted credential round-trip, shop/settings/summary persistence, OpenRouter PKCE state lifecycle.
- **External-API mocks** — Shopify GraphQL fetch (pagination/throttle/mapping) and mutations; AI provider dispatch (Anthropic vs OpenAI-compatible).
- **Route loaders/actions** — plan × connection gating, selected-field apply, and the OAuth callback's cookie/state CSRF check.

Integration tests need a Postgres database; set `TEST_DATABASE_URL` (defaults to the
local `…:5433/ai_storefront_optimizer_test`). The suite runs in CI on every push/PR via
`.github/workflows/ci.yml` (typecheck → lint → tests against a Postgres service → audit).

## Deploy (Render)

Deploys from this repo via the `render.yaml` Blueprint (web service built from the
`Dockerfile` + a managed Postgres).

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, connect the repo. Render provisions the web service
   and Postgres (`DATABASE_URL` is wired automatically).
3. Set the four secret env vars in the Render dashboard:
   `ENCRYPTION_KEY`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, and
   `SHOPIFY_APP_URL=https://<service>.onrender.com`.
4. Point Shopify at the Render host — set `application_url` + `[auth].redirect_urls`
   in `shopify.app.toml` to `https://<service>.onrender.com` (+ `/auth/callback`), then
   run `shopify app deploy`.

The container runs `prisma migrate deploy` on boot, listens on Render's `$PORT`, and
serves a `/healthz` health check. The OpenRouter OAuth callback is at
`https://<service>.onrender.com/openrouter/callback` (derived from `SHOPIFY_APP_URL`).

## Project structure

```
app/
  routes/        app._index (dashboard), app.products, app.products.$id,
                 app.bulk-review, app.settings, app.billing, api.export
  scoring/       rule-based engine (pure TS, unit-tested) + scan.server
  ai/            Anthropic client, prompts, generate
  shopify/       GraphQL queries, mutations, fetch + apply helpers
  billing/       plan definitions, limits, entitlements
  lib/           shop.server (minimal persistence), csv
tests/           vitest scoring tests + fixtures
```
