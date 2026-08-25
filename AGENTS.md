# Repository Guidelines

## Project Structure & Module Organization

- `src/` contains production TypeScript. `src/index.ts`, `src/rpc.ts`, and `src/stock-api/` implement the Host-side RPC and public-market data adapters; `src/client/` contains the Markdown annotator, locale integration, panel, and chart UI.
- `tests/` contains Vitest tests, generally named after the module under test (for example, `tests/public-service.test.ts`).
- `docs/`, `CONTEXT.md`, and `design-qa.md` hold architecture notes and visual references. `cordis.patch.yml` defines the DSH bundle integration, and `scripts/verify-package.mjs` checks the packaged output.

## Build, Test, and Development Commands

- `npm install` — install the pinned development dependencies.
- `npm run typecheck` — run strict TypeScript checking without emitting files.
- `npm test` — run the Vitest suite in `tests/`.
- `npm run build` — emit declarations and bundle the Host and Client entry points.
- `npm run verify` — run typecheck, tests, build, and package verification; use this before submitting changes.
- `npm run verify:package` — validate the generated package independently.

There is no standalone dev server in this repository; exercise the built plugin through the DSH web host when validating UI or RPC behavior.

## Coding Style & Naming Conventions

Use strict TypeScript with ES modules, two-space indentation, semicolons, and descriptive `camelCase` variables/functions. Use `PascalCase` for React components and types, and keep styles in colocated `*.module.css` files. Prefer narrow typed boundaries and explicit normalization at data-source edges. Keep client code read-only: upstream market requests belong in `src/stock-api/` behind the RPC contract.

## Testing Guidelines

Add or update focused Vitest tests for every behavior change. Cover parser normalization, fallback data sources, locale behavior, request cancellation, and RPC contracts where relevant. Run `npm test` during iteration and `npm run verify` before handoff; no separate coverage threshold is configured.

## Commit & Pull Request Guidelines

Use concise Conventional Commit subjects such as `feat: add ...`, `fix: handle ...`, or `test: cover ...`. Pull requests should explain the user-visible behavior, implementation boundary, and verification command. Include screenshots or recordings for panel/chart changes, and call out any DSH host or data-source assumptions.

## Security & Configuration Tips

Do not add API keys, cookies, or private endpoints. The client submits only confirmed stock candidates; keep arbitrary URLs, full assistant content, and credentials out of upstream requests. Preserve source fallback and timeout behavior when changing market-data adapters.
