# Multi-Product Cross-Platform Monorepo — Scaffold Plan

> **Naming conventions:** package scope `@platform/*`; bundle ids `com.example.*`
> (placeholder until a real reverse-domain is chosen); infra names follow
> `<org>-<product>-<env>` (org placeholder `example`); products are `template` (the
> working template at `products/_template`) + `demo` (stamped proof). Product names —
> never the monorepo's name — drive all app ids, slugs, and infra naming, so the scaffold
> stays portable and products stay independently brandable. Keep placeholders
> (`example`, `com.example.*`, `TODO-EAS-PROJECT-ID`, releases-repo owner) clearly
> marked; swap them for real org values when infra accounts exist.

## Context

This work scaffolds a **platform/template monorepo** hosting multiple independent
cross-platform mini-products. Each product ships to iOS, Android, web, and desktop from
**one shared UI codebase**, backed by its own FastAPI service and fully segregated infra
(own Fly apps, Supabase projects per env, Vercel project, EAS project, Electron identity)
— all in one org. New products are stamped from `products/_template` by a generator
script.

Goal of this build: `products/_template` working end-to-end on all 4 targets (shared
NativeWind button/screen + FastAPI hello + OpenAPI→TS type-gen), then stamp one `demo`
product to prove the generator.

## Decision Sheet (locked with user)

- **Monorepo:** pnpm workspaces + Turborepo 2.9 (`--affected`); mise pins Node 22 / pnpm 10 / Python 3.13 / uv
- **Frontend:** Expo SDK 56 (RN 0.85) + react-native-web, managed + EAS; **NativeWind v4** (v5 is pre-release — do NOT use); Expo Router; TanStack Query + Zustand; per-platform overrides via `.ios/.android/.web/.native` extensions
- **Design system:** **react-native-reusables** adopted INTO `packages/ui` (shadcn model: components are copied in and OWNED, not a black-box dep); cva variants + `className` escape hatch; **semantic CSS-variable tokens** (`--background`, `--primary`, …) with **light+dark from day 1** (runtime-switchable); per-product branding = each product overrides token VALUES, never component code
- **Code sharing:** `packages/core` = plumbing only (supabase client factory, auth session store + route guards, query client **with cache persistence** — AsyncStorage native / localStorage web —, env, Sentry init); features are **product-local** (`app/features/<feature>/`, route files stay thin one-liners); **promote to `packages/*` on 2nd use** (documented convention)
- **Template lifecycle:** stamped products are **snapshots** — divergence accepted, template kept thin, reusables pushed down into `packages/*`; shared packages **co-evolve** (`workspace:*`, breaking change = fix all consumers in same PR, CI `--affected` enforces); `_template` app is a **rich starter**: auth screens (login/signup on core plumbing), API-backed list screen, settings with theme/dark toggle, tab navigation
- **Desktop:** Electron bundling the exported Expo web build; electron-builder + electron-updater (GitHub Releases)
- **Backend (per product):** FastAPI (Pydantic v2), uv + Ruff, SQLModel + Alembic, Dockerized → Fly.io (staging + production apps)
- **Topology (hybrid):** core data via FastAPI → Supabase Postgres (pooler 6543); Supabase Auth (FastAPI verifies JWTs); `supabase-js` on frontend ONLY for auth/Realtime/Storage uploads
- **Contracts:** FastAPI OpenAPI → `@hey-api/openapi-ts` (pinned exact, pre-1.0) + TanStack Query plugin; generated client committed per product
- **Hosting:** web → Vercel (one project/product, turbo-ignore); per-env separate Supabase projects; local dev via Supabase CLI stack
- **Quality:** ESLint flat config + Prettier; Ruff; Vitest/Jest + RNTL; Playwright (web E2E); Maestro (mobile E2E); pytest + httpx + typegen drift check; GitHub Actions (affected-only)
- **Cross-cutting:** Sentry (`@sentry/react-native` — NOT deprecated `sentry-expo`), Expo Push, Supabase Storage/CDN
- **Multi-product:** `products/<name>/` consuming shared `packages/{ui,core,config}`; `pnpm new-product <name>` generator; infra naming `<org>-<product>-<env>`
- **Env/config:** frontend config is publishable-only (`EXPO_PUBLIC_*`) in **committed per-env files** (`.env.development/.staging/.production` in each product's `app/`; gitignore allows these, still ignores `.env` + `.env.local`); EAS profiles / Vercel envs select them. Secrets live in **each platform's native store** (Fly secrets, EAS env, Vercel env, GH Actions) — setup codified in the generator checklist
- **Releases:** trunk-based — `main` → staging auto (API deploy + web previews + **EAS Update OTA to staging channel**); tag `<product>-<surface>-v*` → that product's production (surface = api/app/desktop); mobile = **OTA for JS-only changes**, store builds only when native deps change
- **DB conventions (template defaults):** **UUIDv7 PKs** (SQLModel base model); **RLS deny-all on every table** via the template's initial migration (the API's privileged role bypasses it; PostgREST/Realtime surface locked, opened per-table only where Realtime reads are wanted); schema changes ONLY via Alembic
- **API conventions (template defaults):** thin **routers → services** (services take a session, hold business logic); **RFC 9457 problem+json** error contract (typed into OpenAPI → typed in the generated client); **cursor pagination** (`useInfiniteQuery`-ready); template ships `hello` + `me` + one `items` CRUD example in this shape
- **Realtime (canonical pattern): broadcast-only** — tables stay RLS-locked; after mutations FastAPI broadcasts invalidation events on per-product channels (service-role HTTP call); clients refetch through the API. `packages/core` ships the subscribe-and-invalidate helper (wires channel events → TanStack invalidation). No Postgres-Changes subscriptions, no RLS holes, schema stays private
- **Push notifications: full loop templated** — token registration in the app (expo-notifications), `/v1/push-tokens` endpoint + table (per user+device), `send_push()` service calling Expo's Push API via httpx
- **Observability:** Sentry (already locked) + **structlog JSON logs** + `request_id` middleware in FastAPI; the API-client wrapper sends a generated `X-Request-Id` per request; Sentry events tagged with it on both sides → client→API→logs traceability
- **Docs:** README runbook + generator-printed NEW_PRODUCT checklist; decision-record format (ADRs vs ARCHITECTURE.md) **deferred**

## Key design rulings (architect-verified, June 2026)

1. **ONE Expo app per product** (`products/<name>/app`) serves iOS + Android + web — no
   separate `web/` workspace. Web deploy = `expo export --platform web` → `dist/` → Vercel.
   Desktop wraps that same `dist/`. A product = 3 workspaces (`app`, `desktop`, `api`) +
   generated `api-client`.
2. **Electron routing:** Expo Router has no hash mode and breaks under `file://`. Use a
   privileged **custom `app://` protocol** in main process serving `dist/` with SPA
   fallback to `index.html` (history-API routing + absolute assets + offline all work).
   Requires `web.output: "single"` (SPA) in `app.config.ts`.
3. **electron-updater collision:** GitHub provider resolves "latest release of the repo" —
   multiple products in one monorepo collide. Each product's desktop publishes to its own
   `<org>/<product>-desktop-releases` repo (placeholder until real org/repo exists).
4. **Supabase pooler reality:** port 6543 is transaction-mode only (session mode removed
   2025); asyncpg prepared statements break. Use **psycopg v3** + `prepare_threshold=None`
   + `NullPool`. **Alembic migrates over direct port 5432** via separate
   `DATABASE_MIGRATION_URL`, run as Fly release command.
5. **JWT verify:** new Supabase projects use asymmetric keys → verify via JWKS
   (`PyJWKClient`, ES256/RS256, cached); HS256 + `SUPABASE_JWT_SECRET` fallback because the
   **local CLI stack still issues HS256**.
6. **pnpm + Expo:** `.npmrc` with `node-linker=hoisted` (still the documented happy path);
   explicit `watchFolders`/`nodeModulesPaths` in metro config; never set
   `disableHierarchicalLookups`.
7. **Template is a working product:** `products/_template` matches workspace globs and
   builds in CI so it never rots. It uses the literal product name `template`; the
   generator whole-word-replaces `template` (kebab/Pascal/snake variants) in contents AND
   paths.
8. **Theming mechanism is CSS variables, not tailwind values:** the shared tailwind
   preset maps semantic color names to vars (`primary: "hsl(var(--primary))"`, …);
   `packages/ui` ships the default light/dark theme blocks (CSS vars on web, NativeWind
   `vars()` objects on native); each product overrides variable VALUES in its own theme
   file/global.css. One set of components, per-product brand, runtime dark mode — and the
   identical mechanism on all four targets.
9. **Rich-starter inheritance instead of shared screens:** auth/login screens live in the
   template's `app/features/auth/` (product-local), so every stamped product COPIES a
   working auth UI it can freely restyle — reuse without coupling products to a shared
   screens package. Only auth plumbing (session store, guards) is shared via
   `packages/core`.

## Directory tree

```
<root>/
├── mise.toml                      # node 22, pnpm 10, python 3.13, uv
├── .npmrc                         # node-linker=hoisted
├── pnpm-workspace.yaml            # packages/*, products/*/{app,desktop,api,api-client}
├── package.json                   # scripts: new-product; devDeps: turbo, prettier
├── turbo.json                     # task graph (see below)
├── tsconfig.base.json             # strict, moduleResolution bundler, noEmit
├── .gitignore
├── .github/workflows/
│   ├── ci.yml                     # affected lint/typecheck/test/build + typegen drift
│   ├── deploy-api.yml             # Fly: main→staging, tag <product>-api-v*→prod
│   ├── eas-build.yml              # dispatch(product,profile) + tag <product>-app-v*
│   └── electron-release.yml       # tag <product>-desktop-v* → 3-OS matrix
├── scripts/new-product.mjs        # generator (plain Node, zero deps)
├── packages/
│   ├── config/                    # @platform/config: eslint flat config, prettier.json,
│   │   └── ...                    #   tailwind-preset.js (design tokens), tsconfig/{base,expo,node}.json
│   ├── ui/                        # @platform/ui — react-native-reusables components (OWNED,
│   │   ├── package.json           #   copied in via its CLI), consumed AS SOURCE, no build
│   │   └── src/
│   │       ├── index.ts
│   │       ├── components/ui/     # button.tsx, text.tsx, input.tsx, card.tsx, ... (cva variants)
│   │       └── lib/{utils.ts,     # cn() helper
│   │                theme.ts}     # default light/dark themes: CSS vars (web) + vars() (native)
│   └── core/                      # @platform/core — plumbing ONLY (no screens)
│       └── src/{index.ts,supabase.ts,auth.ts,    # session store + route guards
│                query.ts,                        # query client + cache persistence
│                realtime.ts,                     # subscribe-and-invalidate helper
│                notifications.ts,                # push-token registration helper
│                api.ts,                          # client wrapper: baseUrl, auth header,
│                env.ts,sentry.ts}                #   X-Request-Id injection
└── products/
    ├── _template/                 # WORKING product; name token = literal `template`
    │   ├── product.json           # {"name":"template","portIndex":0} generator metadata
    │   ├── .env.example           # server-side secrets template (api)
    │   ├── supabase/{config.toml,migrations/}   # project_id example-template; ports from portIndex
    │   ├── app/                   # @platform/template-app (iOS+Android+WEB)
    │   │   ├── app.config.ts      # web.output "single", scheme, com.example.template,
    │   │   │                      #   extra.eas.projectId: "TODO-EAS-PROJECT-ID"
    │   │   ├── .env.development · .env.staging · .env.production   # committed, publishable only
    │   │   ├── eas.json           # build profiles + update channels (staging/production)
    │   │   ├── metro.config.js · babel.config.js
    │   │   ├── tailwind.config.js               # preset + PRODUCT TOKEN OVERRIDES (brand)
    │   │   ├── global.css · theme.ts            # product's CSS-var values (light+dark)
    │   │   ├── vercel.json                      # SPA rewrite
    │   │   ├── features/                        # product-local screens & logic (rich starter)
    │   │   │   ├── auth/                        # login/signup screens on core plumbing
    │   │   │   ├── home/                        # list screen via generated API hooks
    │   │   │   └── settings/                    # theme/dark-mode toggle
    │   │   └── app/                             # expo-router routes — THIN one-liners
    │   │       ├── _layout.tsx                  # theme + query(+persist) + auth providers
    │   │       ├── (auth)/{login,signup}.tsx
    │   │       └── (tabs)/{_layout,index,settings}.tsx
    │   ├── desktop/               # @platform/template-desktop
    │   │   ├── electron-builder.yml             # appId com.example.template.desktop;
    │   │   │                                    #   publish → <org>/template-desktop-releases
    │   │   └── src/{main.ts,preload.ts}         # app:// protocol + SPA fallback + autoUpdater
    │   ├── api/                   # FastAPI; ALSO a pnpm workspace (script shim → uv run)
    │   │   ├── package.json       # @platform/template-api; dev/lint/test/openapi via uv
    │   │   ├── pyproject.toml · uv.lock · Dockerfile
    │   │   ├── fly.staging.toml   # app = "example-template-api-stg"; release_command alembic
    │   │   ├── fly.production.toml
    │   │   ├── alembic.ini · alembic/{env.py,versions/}   # initial migration incl. RLS deny-all
    │   │   ├── src/template_api/{main.py,settings.py,auth.py,db.py,
    │   │   │                     middleware.py,           # request_id + structlog binding
    │   │   │                     models.py,               # UUIDv7 base model; push_tokens
    │   │   │                     errors.py,               # problem+json handlers
    │   │   │                     pagination.py,           # cursor pagination helpers
    │   │   │                     routers/{hello,me,items,push}.py,
    │   │   │                     services/{items,push,realtime}.py,  # logic; send_push();
    │   │   │                     export_openapi.py}       #   broadcast invalidation
    │   │   └── tests/{test_hello.py,test_auth.py,test_items.py}
    │   └── api-client/            # @platform/template-api-client (GENERATED, committed)
    │       ├── openapi-ts.config.ts             # input ../api/openapi.json
    │       └── src/                             # hey-api output: sdk/types/tanstack hooks
    └── demo/                      # stamped by `pnpm new-product demo` (portIndex=1)
```

## Config essentials & gotchas

**turbo.json (2.9 `tasks`):** `openapi` (api pkgs; `inputs: ["src/**/*.py","pyproject.toml","uv.lock"]`,
`outputs: ["openapi.json"]`) → `api-client#build` runs openapi-ts (`dependsOn: ["^openapi","^build"]`
via package-level turbo.json) → app `build`/`export:web` (`dependsOn: ["^build"]`) →
`desktop#build` (`dependsOn: ["^export:web"]`, copies `../app/dist` → `renderer/`). `dev` =
`cache:false, persistent`. Dependency edges come from real `dependencies`/`devDependencies`
(`api-client` devDepends on its `api`; `desktop` devDepends on its `app`). Python `inputs`
globs are mandatory or caching is wrong.

**metro.config.js (template app):**
```js
const config = getDefaultConfig(__dirname);
config.watchFolders = [workspaceRoot];           // ../../..
config.resolver.nodeModulesPaths = [projectRoot+"/node_modules", workspaceRoot+"/node_modules"];
module.exports = withNativeWind(config, { input: "./global.css" });
```
**babel.config.js:** `[["babel-preset-expo",{jsxImportSource:"nativewind"}],"nativewind/babel"]`.
**tailwind.config.js:** presets `@platform/config/tailwind-preset`; content = app globs +
`path.dirname(require.resolve("@platform/ui/package.json")) + "/src/**/*.{ts,tsx}"`
(robust cross-package globs; `packages/ui` has NO tailwind config of its own).
**Theming wiring:** the preset maps semantic colors to CSS vars
(`primary: "hsl(var(--primary))"`, `background`, `foreground`, `muted`, `border`, …);
`packages/ui/src/lib/theme.ts` exports default light/dark values (react-native-reusables
convention) — web gets them as `:root`/`.dark` blocks in `global.css`, native via
NativeWind `vars()` in the theme provider. A product rebrands by overriding variable
values in its own `theme.ts`/`global.css`; component code is never forked. Pin
react-native-reusables' `@rn-primitives/*` deps exactly like other pre-1.0 tools.

**Electron main.ts essentials:** `protocol.registerSchemesAsPrivileged([{scheme:"app",
privileges:{standard:true,secure:true,supportFetchAPI:true}}])`; `protocol.handle("app", ...)`
maps URL path → file under `renderer/`, falling back to `index.html` when missing/dir;
`win.loadURL("app://-/")`; `autoUpdater.checkForUpdatesAndNotify()`. macOS auto-update
needs signing/notarization — gate publish to win/linux until certs exist.

**api/db.py:** `create_engine(url, poolclass=NullPool, connect_args={"prepare_threshold": None})`
(psycopg3, pooler 6543). **auth.py:** JWKS via `PyJWKClient` (cached), `audience="authenticated"`,
algs ES256/RS256; HS256 local fallback. Expose `CurrentUser` dependency.
**export_openapi.py:** writes `app.openapi()` JSON, sorted keys (stable diffs), no server needed.
**Dockerfile:** multi-stage `ghcr.io/astral-sh/uv` (`uv sync --frozen --no-dev` → slim runtime).
Python deps: fastapi, uvicorn[standard], pydantic-settings, sqlmodel,
sqlalchemy[postgresql-psycopg], psycopg[binary], alembic, pyjwt[crypto], httpx,
sentry-sdk[fastapi], structlog; dev: pytest, ruff.

**Typegen:** `@hey-api/openapi-ts` pinned exact + `@hey-api/client-fetch` + TanStack Query
plugin (generates `queryOptions`/typed SDK — beats openapi-typescript+openapi-fetch which
needs hand-written glue). Output committed; CI drift check:
`turbo run openapi build --filter=*api-client* && git diff --exit-code products/*/api-client products/*/api/openapi.json`.
App sets client baseUrl from `EXPO_PUBLIC_API_URL` at startup.

**Generator (`scripts/new-product.mjs`, plain Node):**
1. Validate `/^[a-z][a-z0-9-]*$/`, refuse collisions; `portIndex` = max+1.
2. Copy `_template` → `products/<name>` (skip node_modules/.venv/dist/.expo/release; keep uv.lock).
3. Whole-word replace `template`/`Template`/`template_api` in contents AND paths → kebab/Pascal/snake variants (covers package names, slug/scheme/bundle ids, electron appId + releases repo, fly app names, pyproject module, alembic, supabase project_id).
4. Ports from portIndex: API `8000+10i`; Supabase block `54321+100i` → products' local stacks coexist.
5. Write `.env.example` + `product.json`; `pnpm install`.
6. Print infra checklist: 2 Supabase projects (`<org>-<name>-stg|prod`), `fly apps create <org>-<name>-api-stg|prod` + secrets, Vercel project (root `products/<name>/app`, build via turbo filter, output `dist`, ignore step `npx turbo-ignore`), `eas init` → paste projectId, create `<name>-desktop-releases` repo + `GH_TOKEN`, 4 Sentry projects + DSNs, per-product GH Action secrets.

**Workflows:** `ci.yml` — mise-action → pnpm frozen install → uv sync (affected apis) →
`turbo run lint typecheck test build openapi --affected` → drift check. Web: NO workflow
(Vercel git integration + turbo-ignore per product). `deploy-api.yml` — paths-filter on
`products/*/api/** + packages/**` → matrix `flyctl deploy -c fly.staging.toml`; tags →
prod. `eas-build.yml` — dispatch/tag; needs `EXPO_TOKEN`, committed `.npmrc`,
`packageManager` field in root package.json (eas-cli workspace detection workaround).
`eas-update.yml` — OTA: on main push affecting a product's app → `eas update --channel
staging`; tag `<product>-ota-v*` → `--channel production` (store builds only for native
changes via `eas-build.yml`).
`electron-release.yml` — 3-OS matrix, `electron-builder --publish always`, tag must match
`desktop/package.json` version. All repo-specific values are clearly-marked placeholders
until the real repo/org exists.

## Phases (each independently verifiable)

| # | Build | Verify |
|---|---|---|
| 1 | Root tooling: mise.toml, .npmrc, workspace+turbo+tsconfig, .gitignore, `packages/config` | `mise install && pnpm install && pnpm turbo run lint` (clean no-op) |
| 2 | `packages/ui`: adopt react-native-reusables (button/text/input/card) + theme infra (CSS vars, light/dark); `packages/core` (query+persist, env); `_template/app` shell: tabs, settings screen with working theme toggle | dev server → themed components at `localhost:8081`, dark toggle works; Expo Go on device; `turbo run export:web` + `npx serve dist`. **Settles NativeWind v4 ↔ SDK 56 compat; fallback = SDK 55** |
| 3 | `_template/api`: full layout — routers→services, UUIDv7 base model, problem+json handlers, cursor pagination, /healthz + /v1/hello + /v1/items CRUD, auth.py, db.py, initial Alembic migration (incl. RLS deny-all), Dockerfile, fly tomls, pytest | `turbo run dev --filter=*template-api` + `curl localhost:8000/healthz`; items CRUD + paging via curl; error responses are problem+json; `turbo run test lint`; `docker build` |
| 4 | Typegen: export_openapi.py, `api-client/` (hey-api), turbo wiring; `features/home` list screen renders /v1/hello via generated TanStack hook (cache-persisted) | `turbo run build --filter=*template-app` shows openapi→client→app order; model change regenerates types; web renders API data; reload shows cached data instantly |
| 5 | Desktop: main/preload, `app://` protocol, electron-builder.yml, updater (no-op w/o repo) | `turbo run build` + start → same screen in window; navigation works; API down → shell still launches; `electron-builder --dir` packs |
| 6 | Supabase local + auth: per-product config.toml; core plumbing (session store, guards); `features/auth` login/signup screens + `(auth)`/`(tabs)` route guards; protected `/v1/me` | `supabase start`; sign up through the template's login screen; guarded tabs redirect when signed out; bearer-token curl → user id; bad token → 401 |
| 7 | Generator + stamp `demo` product | `pnpm new-product demo`; both products build via `--affected`; both local stacks run simultaneously; `git grep -iw template products/demo` empty |
| 8 | CI/CD workflows + observability (structlog JSON, request_id middleware, X-Request-Id in client wrapper, Sentry init) + push loop (registration → /v1/push-tokens → send_push) + realtime broadcast pattern (api broadcast + core subscribe-and-invalidate on the items list) + README runbook | push branch → CI green; touch one product → other is cache-hit; stale openapi.json fails drift check; items list refreshes across two open clients after a mutation; API log lines carry the request_id sent by the client |

Each phase = one commit (or a few logical commits) on a feature branch.

## Verification (end-to-end, after Phase 8)

1. `mise install && pnpm install && pnpm turbo run lint typecheck test build` — all green.
2. One shared `@platform/ui` component set visibly identical on: web (`localhost:8081`),
   device (Expo Go), desktop (Electron window) — all rendering data fetched from FastAPI
   via the generated TanStack hook, with the dark-mode toggle re-theming every target via
   the same CSS-variable mechanism, and the `demo` product showing different brand token
   values than `template` with unmodified component code.
3. Type-drift guard: edit a Pydantic response model → `turbo run openapi build` → committed
   client diff appears; skipping regen fails CI.
4. Multi-product proof: `_template` and `demo` dev stacks (Expo + API + Supabase local)
   running at the same time, distinct ports; `--affected` only rebuilds the touched product.
5. Naming audit: all app ids/slugs/infra names derive from product names (`template`,
   `demo`) with clearly marked `example` org placeholders — `git grep -inE 'example|TODO'`
   surfaces exactly the intended swap-points and nothing else.
