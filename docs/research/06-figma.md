# Figma bridge — accuracy review (June 2026)

## Summary

**18 claims checked** across the Figma design-system bridge domain: REST Variables API (gating, endpoint shape, auth, modes/collections model), Tokens Studio plugin, Style Dictionary, Figma Code Connect (`*.figma.tsx`, CLI publish, React Native), and the Figma MCP server tool surface.

- ✅ Verified accurate: **12**
- ⚠️ Minor issue / imprecise / needs a tweak: **5**
- ❌ Wrong: **1**
- ❓ Could not fully confirm from a primary source: **0** (all Figma developer-docs pages 403 WebFetch; corroborated via official-doc search excerpts, npm registry, plugin/help-center pages, and the live MCP tool manifest)

**Headline:** The plan's central architectural bet is **correct and well-founded**. The Figma REST Variables API (`GET /v1/files/:key/variables/local`) **remains Enterprise-plan-only in June 2026**, which is precisely why defaulting `figma-tokens.mjs` to Tokens Studio JSON (tier-independent, CI-runnable, reviewable diff) and treating REST as the `source:"rest"` Enterprise path is the right call. The variables→modes/collections model, the `X-Figma-Token` auth header, the MCP tool names (`get_variable_defs`, `get_design_context`, `get_code_connect_suggestions`, `get_metadata`), Code Connect's `*.figma.tsx` + React Native support, and Style Dictionary all check out.

**The one real error:** the plan/tree says the Code Connect CLI config lives in a **`.figma/` directory** (PLAN tree line: "`.figma/` — Code Connect CLI config"; phase-2 step (d): "`.figma/figma.config.json`"). Code Connect's config file must be named **`figma.config.json`** and located at the **project root** (next to `package.json`); `include`/`exclude` globs are resolved relative to that file. A `.figma/figma.config.json` will not be discovered by the CLI. Also worth tightening: the env var for the Code Connect CLI is **`FIGMA_ACCESS_TOKEN`** (not the `FIGMA_TOKEN` the plan uses for both flows), and Style Dictionary is now **v5** (5.4.4) — the plan doesn't pin a major and the phase guide's `vars(...)`/hand-rolled emitter sidesteps SD's actual transform/format machinery.

**Verdict on the Enterprise-only Variables API gating: CONFIRMED.** Evidence below (Finding 1).

---

## Findings

### 1. Figma REST Variables API is Enterprise-plan-only
- **Location:** PLAN.md ruling-area "Figma bridge" decision (line 44: "Figma REST Variables API on Enterprise plans"); PLAN.md gotcha "Figma bridge" (line 302–311); phase-2 step (e) + Gotcha "Figma REST Variables API is Enterprise-only" (lines 1448–1451); DoD #8.
- **Claim:** `GET /v1/files/:key/variables/local` requires an Enterprise plan, so the token pipeline defaults to Tokens Studio JSON and uses REST only on Enterprise.
- **Status:** ✅
- **Finding:** Confirmed current as of June 2026. Figma's official Variables-endpoints docs and forum/help sources state the Variables REST API is available **only to full members of Enterprise orgs**, and the variables scopes (`file_variables:read`, `file_variables:write`) are **only grantable on the Enterprise plan**. This is a hard gate, not a rate limit — it is distinct from the *MCP server*, which is available on Professional/Organization/Enterprise (see Finding 13). The plan's reasoning ("this is why Tokens Studio JSON is the default") is sound and the abstraction-behind-one-interface design is the right hedge.
- **Recommended change:** None. Optionally note in the plan that the *required scope* is `file_variables:read` (Enterprise-only), to make the gating mechanism explicit.
- **Source(s):** Figma Developer Docs — Variables Endpoints; Figma Enterprise plan page; Figma forum "Why's the Variables API only available on enterprise plans?" and "Scopes for Enterprise User Access Token in REST API".

### 2. Variables endpoint shape (`GET /v1/files/:key/variables/local`)
- **Location:** PLAN.md gotcha line 302–304; phase-2 step (e) `loadSource()` REST branch (line 837).
- **Claim:** `GET /v1/files/:key/variables/local` is the endpoint to enumerate local variables.
- **Status:** ✅
- **Finding:** Correct. The endpoint enumerates local variables created in the file plus remote variables referenced in it (by `subscribed_id`). The Variables REST API exposes three operations: GET local variables, GET published variables (`/variables/published`), and POST `/variables` (bulk create/update/delete). The plan only needs the local read, which matches.
- **Recommended change:** None.
- **Source(s):** Figma Developer Docs — Variables Endpoints.

### 3. Auth via `X-Figma-Token`
- **Location:** PLAN.md gotcha line 303 ("needs `FIGMA_TOKEN`"); phase-2 step (e) REST branch `headers: { "X-Figma-Token": process.env.FIGMA_TOKEN }` (line 839).
- **Claim:** REST auth uses the `X-Figma-Token` header.
- **Status:** ✅
- **Finding:** Correct. Personal access tokens are passed in the `X-Figma-Token` header (not `Authorization`, which is reserved for OAuth2 bearer tokens). The token must carry `file_variables:read` (Enterprise) plus typically `file_content:read`. The code in step (e) is accurate.
- **Recommended change:** None for the header. (Token *naming* nuance is Finding 11.)
- **Source(s):** Figma Developer Docs — Authentication / Personal access tokens.

### 4. Variables → modes & collections model
- **Location:** PLAN.md ruling #11 (lines 103–110): "a `semantic` Variables collection whose modes are light/dark × brand"; PLAN.md "Figma bridge" decision (line 44); phase-2 step (e) `normalizeRest` "resolve semantic collection modes via cfg.modes".
- **Claim:** Variables are organized into collections; a collection has modes; the semantic collection's modes can model light/dark × brand and map 1:1 to product `theme.ts`/`global.css`.
- **Status:** ✅
- **Finding:** Accurate. The `variables/local` response returns a `meta` object with `variables` and `variableCollections`; each collection carries `id`, `name`, `modes` (each `{ modeId, name }`), `defaultModeId`, and `variableIds`; each variable carries per-mode values keyed by `modeId` (`valuesByMode`). Modeling brand×theme as modes of one `semantic` collection and resolving them through `figma.config.json`'s `modes: { template: <modeId>, demo: <modeId> }` is exactly how the API is shaped. Note: a single collection supports multiple modes only on paid plans (multi-mode is itself a paid feature), which is consistent with the Enterprise-API framing.
- **Recommended change:** None. (Implementation detail: per-mode values live under `valuesByMode[modeId]` and primitive references resolve via `VARIABLE_ALIAS` — the `normalizeRest` adapter will need to dereference aliases, which is what Style Dictionary or a manual resolve step does.)
- **Source(s):** Figma Developer Docs — VariableCollection (Plugin API mirror of the REST shape); Figma Help "Modes for variables"; community write-ups syncing Figma variables → Style Dictionary.

### 5. Tokens Studio plugin — name & current status
- **Location:** PLAN.md "Figma bridge" decision (line 44, "Tokens Studio JSON export"); phase-2 (e); Gotcha lines 1448–1451.
- **Claim:** "Tokens Studio" is a current, maintained Figma plugin that exports token JSON usable as the default source.
- **Status:** ✅
- **Finding:** Correct and current. "Tokens Studio for Figma" (formerly "Figma Tokens") is actively maintained — version 217 published ~May 25 2026. It stores design tokens as JSON, supports GitHub sync, and the plugin/exporter supports multiple JSON formats (Standard, DTCG, Tokens Studio, Style Dictionary). The name "Tokens Studio" used throughout the plan is correct.
- **Recommended change:** None.
- **Source(s):** Tokens Studio docs (docs.tokens.studio); tokens-studio/figma-plugin GitHub; Figma Community plugin page.

### 6. Tokens Studio JSON export format → Style Dictionary
- **Location:** phase-2 step (e): committed `packages/ui/figma/tokens.json` Tokens Studio fixture feeding `figma-tokens.mjs` → Style Dictionary.
- **Claim:** Tokens Studio JSON is a reviewable, CI-runnable source that Style Dictionary can consume.
- **Status:** ⚠️
- **Finding:** Directionally correct but the plan understates a real seam. Tokens Studio's native JSON is **not** plain Style-Dictionary format out of the box — token *references*/aliases (`{color.base.500}`), `$type`/`value` (or `$value` in DTCG mode), and token-set layering need either Tokens Studio's "Style Dictionary" export option, the `@tokens-studio/sd-transforms` preprocessor, or a custom parser. The phase-2 `normalizeTokensStudio()` is left as a `/* … */` stub, so the seam is acknowledged but not designed. With SD v5 defaulting to **DTCG** JSON, choosing Tokens Studio's **DTCG** export + `sd-transforms` is the cleanest path.
- **Recommended change:** In the phase guide, specify that the committed fixture is exported in **DTCG** format and that `@tokens-studio/sd-transforms` (or SD's DTCG parser) handles alias resolution — rather than implying raw Tokens Studio JSON is directly SD-consumable.
- **Source(s):** Tokens Studio docs — JSON View / export formats; `@tokens-studio/sd-transforms`; Style Dictionary v5 migration (DTCG default).

### 7. Style Dictionary — current major version
- **Location:** PLAN.md "Figma bridge" decision (line 44, "→ Style Dictionary"); phase-2 step (e) "Add `style-dictionary` (exact pin)"; Open question (line 1544–1547 lists `style-dictionary` among unpinned).
- **Claim:** Style Dictionary is the transform layer; version unspecified.
- **Status:** ⚠️
- **Finding:** Current Style Dictionary is **v5 (5.4.4, published ~June 8 2026)** — the question "v4 or v5" resolves to **v5**. v5 adopted the DTCG 2025.10 spec revision as its base format, is a near-drop-in upgrade from v4 (small breaking-change budget, internals refactor for reference performance), is fully ESM, and ships first-class `.d.ts` types. The plan correctly leaves it unpinned-until-execution but should explicitly target **v5** and account for ESM-only + DTCG-default.
- **Recommended change:** Pin `style-dictionary@^5` (or exact 5.x) and note v5 is ESM-only and DTCG-default — relevant because `figma-tokens.mjs` is already `.mjs`/ESM (good) and the token fixture should be DTCG.
- **Source(s):** npm `style-dictionary` (5.4.4); Style Dictionary v5 migration guide; Tokens Studio "Style Dictionary V4 release plans" (history).

### 8. Style Dictionary config / "CSS vars" approach in `figma-tokens.mjs`
- **Location:** phase-2 step (e) `emitThemeTs()` + comment "Style Dictionary resolves primitive references → final HSL triples here."
- **Claim:** Style Dictionary transforms tokens → CSS-var values written into `theme.ts`/`global.css`.
- **Status:** ⚠️
- **Finding:** The *script as written* doesn't actually use Style Dictionary's API — it hand-emits a `vars({...})` object and only mentions SD in a comment, while the real SD step (build config with `source`, `platforms`, `transforms`, and the `css/variables` format) is absent. That's fine for a Phase-2 skeleton with a committed fixture, but it means the "recommended Style Dictionary setup" is not yet demonstrated. SD's idiomatic path to the plan's goal is a `css/variables` format (emits `:root { --x: … }`) for `global.css` plus a custom/JS format for the NativeWind `vars()` object — both fed from one resolved token tree. The plan's HSL-triple convention (`"240 6% 10%"`, consumed as `hsl(var(--x))`) requires a custom value transform since SD's stock color transforms output hex/rgb, not space-separated HSL channels.
- **Recommended change:** Note that a **custom Style Dictionary value transform** is needed to emit space-separated HSL channels (to match the `hsl(var(--x))` Tailwind preset), and that two SD formats (`css/variables` for web `global.css` + a JS format for native `vars()`) cover both targets — resolving the existing "co-generate global.css?" open question (phase-2 Open questions, lines 1553–1556) in favor of "yes, SD emits both."
- **Source(s):** Style Dictionary docs — transforms/formats (`css/variables`); v5 migration.

### 9. Code Connect `*.figma.tsx` mapping syntax (`figma.connect`, `figma.string`, `figma.enum`)
- **Location:** phase-2 step (d) `button.figma.tsx` example; PLAN.md "Figma bridge" plane (2) + ruling #11.
- **Claim:** `*.figma.tsx` files call `figma.connect(Component, url, { props: { label: figma.string(...), variant: figma.enum(...) }, example })`.
- **Status:** ✅
- **Finding:** Accurate. The Code Connect React API is exactly this shape: `figma.connect(Component, "<figma-url>", { props: { … }, example: ({…}) => <JSX/> })` with `figma.string("Label")`, `figma.enum("Variant", { Default: "default", … })`, `figma.boolean(...)`, `figma.instance(...)`, `figma.children(...)`. The mapping of Figma variant property values → cva variant prop values in the example is the intended use. Note Code Connect files are parsed as strings (not executed), so the example renders as a snippet — consistent with the plan's "maps are the only in-repo design artifacts."
- **Recommended change:** None.
- **Source(s):** Figma Developer Docs — Code Connect React; figma/code-connect GitHub (issues #74/#80 demonstrating `figma.enum`).

### 10. Code Connect — React Native support
- **Location:** PLAN.md "Figma bridge" plane (2); DOMAIN explicitly asks to verify RN support; phase-2 step (d) uses `import figma from "@figma/code-connect"` with RN components (`@platform/ui` Pressable/Text).
- **Claim:** Code Connect supports React Native and the same `*.figma.tsx` maps work for RN components.
- **Status:** ✅
- **Finding:** Confirmed. Code Connect's React integration **explicitly covers React Native** — the docs are titled "React (and React Native)". Project type is auto-detected as `react` when `package.json` contains React; React Native uses the same `react` parser and the same `@figma/code-connect` import. (The deep import `@figma/code-connect/react` also exists and is equivalent for React/RN; the top-level `import figma from "@figma/code-connect"` the plan uses is valid.) `@figma/code-connect` is current at **1.4.8** (published ~June 9 2026).
- **Recommended change:** None required. Optional: the parser key in `figma.config.json` is `react` (there is **no** `react-native` parser value — valid values are `react | html | swift | compose`); since `@platform/ui` is RN, ensure detection lands on `react`.
- **Source(s):** Figma Developer Docs — Code Connect React (and React Native); npm `@figma/code-connect` 1.4.8; Code Connect config-file docs (parser values).

### 11. Code Connect CLI publish flow + token env var
- **Location:** PLAN.md "Figma bridge" gotcha (line 308, "published via the Code Connect CLI"); phase-2 step (d) commands `pnpm dlx @figma/code-connect parse` and "publish run during /bootstrap-design-system"; PLAN.md `FIGMA_TOKEN` (line 303).
- **Claim:** Maps are validated/published via the Code Connect CLI; `FIGMA_TOKEN` is the credential.
- **Status:** ⚠️
- **Finding:** The CLI flow is right (`figma connect parse` to validate, `figma connect publish` to publish, `figma connect create` for interactive scaffolding). But the **env var name is `FIGMA_ACCESS_TOKEN`** (or `--token`), **not** `FIGMA_TOKEN`. The plan uses `FIGMA_TOKEN` for both the REST Variables pull (step (e)) and Code Connect — the REST `fetch` reads whatever env you set, so `FIGMA_TOKEN` works *there*, but the Code Connect CLI specifically reads `FIGMA_ACCESS_TOKEN` from env/.env. Publishing also requires a token with **`code_connect:write` + `file_content:read`** scopes. Using one env name for two tools will silently fail the publish step.
- **Recommended change:** Use `FIGMA_ACCESS_TOKEN` for the Code Connect CLI (document the required scopes `code_connect:write`, `file_content:read`); keep a separate `FIGMA_TOKEN` (or reuse) for the REST pull but document that the REST path additionally needs `file_variables:read` (Enterprise). Update PLAN.md line 303 and phase-2 step (d) accordingly.
- **Source(s):** figma/code-connect CLI docs (`FIGMA_ACCESS_TOKEN`, `--token`); Code Connect CLI scopes guidance; figma/code-connect issue #111.

### 12. Code Connect CLI config location — `.figma/` directory
- **Location:** PLAN.md directory tree (line 154: "`.figma/` — Code Connect CLI config (publish *.figma.tsx maps)"); phase-2 step (d) ("Configure the CLI in the **root** `.figma/` … e.g. `.figma/figma.config.json` with `codeConnect.include = ["packages/ui/src/**/*.figma.tsx"]`").
- **Claim:** Code Connect CLI config lives in a `.figma/` directory (`.figma/figma.config.json`).
- **Status:** ❌
- **Finding:** Wrong location. Code Connect's config file must be named **`figma.config.json`** and placed at the **project root** (alongside `package.json` / `.xcodeproj`). `include`/`exclude` globs are resolved **relative to the config file's location**. The CLI does not discover a `.figma/figma.config.json`; putting it in a subdirectory will break both `parse` and `publish` (and would also break the relative globs). The `codeConnect.include` key itself is correct (`{ "codeConnect": { "include": ["…/*.figma.tsx"], "parser": "react", "label": "React" } }`).
- **Recommended change:** Move the config to a **root `figma.config.json`** (not `.figma/`). Be careful: this is the *same filename* Figma uses for the MCP/REST `figma.config.json` in some examples and is also the name the plan already uses for its **own** token-pipeline `figma.config.json` (root, with `fileKey`/`modes`). These are two different schemas colliding on one filename — keep the plan's token-pipeline file as e.g. `figma.tokens.config.json` (or nest its keys) and reserve root `figma.config.json` for the Code Connect CLI, OR merge Code Connect's `codeConnect` key into the single root `figma.config.json` (Figma's CLI tolerates extra top-level keys). Update the directory tree (drop `.figma/`) and phase-2 step (d).
- **Source(s):** Figma Developer Docs — Code Connect "Configuring your project" (config-file); Code Connect quickstart.

### 13. Figma MCP server — `get_variable_defs`
- **Location:** PLAN.md gotchas "Bootstrap…" (line 316: "`get_variable_defs`/REST dump"); phase-2 step (f) bootstrap command.
- **Claim:** MCP tool `get_variable_defs` extracts the variables/tokens used in a selection.
- **Status:** ✅
- **Finding:** Exists and matches. `get_variable_defs` "extracts the variables and styles used in your selection (color, spacing, typography, etc.)" so the model references tokens directly. Present in the live MCP tool manifest (`mcp__Figma__get_variable_defs`).
- **Recommended change:** None.
- **Source(s):** Figma Help "Guide to the Figma MCP server"; Figma Developer Docs — MCP tools-and-prompts; live MCP manifest.

### 14. Figma MCP server — `get_design_context`
- **Location:** PLAN.md "Figma bridge" plane (2)+(3) (lines 44, "`get_design_context` returns owned components"); ruling #11; phase-2 step (d)/(f).
- **Claim:** `get_design_context` returns code for a selection and (with Code Connect maps published) returns the real `@platform/ui` components.
- **Status:** ✅
- **Finding:** Exists and behaves as described. `get_design_context` returns a structured React+Tailwind representation of the selection as a starting point for codegen; when Code Connect maps are published, those mapped components are surfaced instead of generic JSX (this is the documented purpose of Code Connect + the MCP). Present in the live manifest (`mcp__Figma__get_design_context`). (Note: this tool consolidated/renamed from the earlier `get_code`/`get_code_connect_map` era; the current name `get_design_context` is correct for June 2026.)
- **Recommended change:** None.
- **Source(s):** Figma Developer Docs — MCP tools-and-prompts; Figma blog "Introducing our Dev Mode MCP server"; live MCP manifest.

### 15. Figma MCP server — `get_code_connect_suggestions`
- **Location:** PLAN.md gotchas "Bootstrap…" (line 332: "accelerated by `get_design_context` + `get_code_connect_suggestions`"); phase-2 step (f) bootstrap Step 2.
- **Claim:** `get_code_connect_suggestions` exists and helps map components during bootstrap.
- **Status:** ✅
- **Finding:** Exists. `get_code_connect_suggestions` is called with a Figma URL to surface components that are recognized but unmapped, to drive the mapping work — exactly the bootstrap Step-2 use. Present in the live manifest (`mcp__Figma__get_code_connect_suggestions`). The companion `get_code_connect_map` (node-id → `{codeConnectSrc, codeConnectName}`) also exists.
- **Recommended change:** None.
- **Source(s):** Figma Developer Docs — MCP tools-and-prompts; alexbobes "Figma MCP CTO guide 2026"; live MCP manifest.

### 16. Figma MCP server — `get_metadata`
- **Location:** PLAN.md gotchas "Bootstrap…" (line 318: "`get_metadata` over the Components page → component sets + variant schemas").
- **Claim:** `get_metadata` returns structure/metadata over a page usable to inventory component sets + variant schemas.
- **Status:** ⚠️
- **Finding:** The tool exists but the plan slightly over-specifies its output. `get_metadata` returns a **sparse XML representation** of the selection containing basic properties — layer IDs, names, types, positions, and sizes — intended as a low-cost map for large selections you then drill into. It does **not** by itself return rich "component-property/variant schemas"; you'd combine it with `get_design_context`/`get_variable_defs` (or `get_code_connect_suggestions`) to recover variant axes. The bootstrap procedure will work, but "get_metadata → component sets + their component-property/variant schemas" is optimistic about what one call yields.
- **Recommended change:** Reword the bootstrap Step-0 component-manifest line to: `get_metadata` for the cheap layer/component inventory, then `get_design_context`/`get_code_connect_suggestions` to recover variant schemas per component set.
- **Source(s):** Figma Developer Docs / Help — MCP tools-and-prompts (`get_metadata` = sparse XML, layer IDs/names/types/position/size); live MCP manifest.

### 17. MCP drives all three planes; read access via "Dev Mode MCP or FIGMA_TOKEN"
- **Location:** PLAN.md "Figma bridge" decision (line 44, "Figma official MCP server drives all three"); gotchas "Bootstrap…" Step 0 (line 316: "read access (MCP Dev Mode or `FIGMA_TOKEN`)").
- **Claim:** The official MCP server can drive tokens+components+screens; bootstrap read access is via MCP Dev Mode or a REST token.
- **Status:** ⚠️
- **Finding:** True but the plan blurs two different access tiers. The **MCP server** is available to **Dev or Full seats on Professional / Organization / Enterprise** (Starter / View / Collab seats get only ~6 tool calls/month) and connects via either a **remote hosted server** (no desktop app) or a **local desktop server**. The **REST Variables API**, by contrast, is **Enterprise-only** (Finding 1). So "MCP Dev Mode OR FIGMA_TOKEN" are not equivalent fallbacks: MCP works on Professional+, but the `FIGMA_TOKEN` REST-variables path needs Enterprise. For a non-Enterprise team the realistic bootstrap is **MCP (`get_variable_defs`) + Tokens Studio JSON**, not REST.
- **Recommended change:** Clarify in the bootstrap doc that the REST (`FIGMA_TOKEN`) path is Enterprise-only, whereas the MCP `get_variable_defs` path works on Professional+ with a Dev/Full seat — and that the committed Tokens Studio fixture is the no-paid-tier fallback.
- **Source(s):** Figma Help "Guide to the Figma MCP server" + pricing/seats updates; Figma Developer Docs — MCP; toolradar/costbench pricing corroboration.

### 18. `FIGMA.md` "publish as a team library" / two-library structure (Foundations + Components)
- **Location:** PLAN.md "Docs & agent surface" (line 56) + gotchas "Bootstrap…" (line 313: "two libraries: **Foundations** = Variables; **Components** = component sets"); phase-2 step (f) FIGMA.md.
- **Claim:** Variables + components should be published as team libraries so MCP read access + Code Connect resolve them.
- **Status:** ✅
- **Finding:** Consistent with Figma's model. Variables can be published in libraries and consumed across files; component sets publish as a library; Code Connect resolves against published components; and the MCP server reads from files/libraries the seat can access. Splitting Foundations (Variables) from Components (component sets) is a reasonable, supported convention (not a Figma-mandated split, but valid). No factual error.
- **Recommended change:** None (it's a convention, not an API claim — fine as written).
- **Source(s):** Figma Help — Modes for variables / publishing libraries; Code Connect docs (resolves published components).

---

## Resolved OPEN / TO CONFIRM

- **Phase-2 Gotcha "Figma REST Variables API is Enterprise-only" / DoD #8 premise** → **CONFIRMED Enterprise-only** (Finding 1). The Tokens-Studio-JSON-default decision is correctly justified; DoD #8 can legitimately pass against the committed fixture with no Figma file.
- **"v4 or v5?" (Style Dictionary, implied by DOMAIN)** → **v5** (5.4.4, June 2026); ESM-only, DTCG-default. Pin `style-dictionary@5`. (Finding 7.)
- **Phase-2 Open question "theme.ts vs global.css co-generation"** → Resolvable in favor of **co-generating both**: Style Dictionary's `css/variables` format emits the web `:root`/`.dark` blocks and a JS format emits the native `vars()` object from the same resolved token tree; a custom HSL-channel transform is required to match the `hsl(var(--x))` preset. (Finding 8.)
- **Code Connect React Native support (DOMAIN)** → **Supported** via the React integration/parser; `@figma/code-connect` 1.4.8; top-level import valid. (Finding 10.)
- **MCP tool names (DOMAIN)** → All four named tools exist with current names: `get_variable_defs`, `get_design_context`, `get_code_connect_suggestions`, `get_metadata` (plus `get_code_connect_map`, `get_screenshot`, `add_code_connect_map`, `send_code_connect_mappings`). (Findings 13–16.)
- **Not in scope / not resolved here:** NativeWind v4↔SDK56 compat, exact `@rn-primitives/*` pins, Storybook dev port, real Figma file key/mode IDs — these are execution-time or non-Figma-domain items and are left to their owners.

---

## Sources

- Figma Developer Docs — Variables Endpoints: https://developers.figma.com/docs/rest-api/variables-endpoints/
- Figma Developer Docs — Authentication / Personal access tokens: https://developers.figma.com/docs/rest-api/personal-access-tokens/ and https://developers.figma.com/docs/rest-api/authentication
- Figma Enterprise plan: https://www.figma.com/enterprise/plan/
- Figma forum — "Why's the Variables API only available on enterprise plans?": https://forum.figma.com/suggest-a-feature-11/why-s-the-variables-api-only-available-on-enterprise-plans-36426
- Figma forum — "Scopes for Enterprise User Access Token in REST API": https://forum.figma.com/ask-the-community-7/scopes-for-enterprise-user-access-token-in-rest-api-13831
- Figma Developer Docs / Plugin — VariableCollection: https://www.figma.com/plugin-docs/api/VariableCollection/
- Figma Help — Modes for variables: https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables
- Figma Help — Guide to the Figma MCP server: https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server
- Figma Developer Docs — MCP tools and prompts: https://developers.figma.com/docs/figma-mcp-server/tools-and-prompts
- Figma blog — Introducing the Dev Mode MCP server: https://www.figma.com/blog/introducing-figma-mcp-server/
- figma/mcp-server-guide (DeepWiki + GitHub): https://deepwiki.com/figma/mcp-server-guide and https://github.com/figma/mcp-server-guide/
- alexbobes — Figma MCP CTO guide 2026 (tool-count corroboration): https://alexbobes.com/tech/figma-mcp-the-cto-guide-to-design-to-code-in-2026/
- Figma Developer Docs — Code Connect Introduction: https://developers.figma.com/docs/code-connect/
- Figma Developer Docs — Code Connect React (and React Native): https://developers.figma.com/docs/code-connect/react and https://www.figma.com/code-connect-docs/react
- Figma Developer Docs — Code Connect config file: https://developers.figma.com/docs/code-connect/api/config-file/ and https://www.figma.com/code-connect-docs/api/config-file/
- Figma Developer Docs — Code Connect quickstart/CLI: https://developers.figma.com/docs/code-connect/quickstart-guide/ and https://deepwiki.com/figma/code-connect/2.1-cli-commands
- figma/code-connect GitHub + issues (#74 figma.enum, #80, #111 token/config): https://github.com/figma/code-connect and https://github.com/figma/code-connect/blob/main/cli/scripts/README.md
- npm — @figma/code-connect (1.4.8): https://www.npmjs.com/package/@figma/code-connect
- npm — style-dictionary (5.4.4): https://www.npmjs.com/package/style-dictionary
- Style Dictionary v5 migration guide: https://styledictionary.com/versions/v5/migration/
- zeroheight — Migrating to Style Dictionary v5: https://help.zeroheight.com/hc/en-us/articles/48049028236187-Migrating-to-Style-Dictionary-v5-in-tokens-automation
- Tokens Studio for Figma — docs + plugin + repo: https://docs.tokens.studio/ , https://docs.tokens.studio/manage-tokens/token-sets/json-view , https://www.figma.com/community/plugin/843461159747178978/tokens-studio-for-figma , https://github.com/tokens-studio/figma-plugin
- Figma pricing/seats (MCP seat gating): https://help.figma.com/hc/en-us/articles/27468498501527-Updates-to-Figma-s-pricing-seats-and-billing-experience and https://www.figma.com/pricing/
