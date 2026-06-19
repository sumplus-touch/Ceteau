# design-sync notes — CeTeau AI UI (cowork-client)

## What this repo is
This is an **application** (`tiger_cowork` / "cowork"), not a published component
library. There is no dist library entry and no `.d.ts` export tree. The sync was
explicitly requested against the app's `client/src` components anyway.

## How the build is wired
- **Barrel entry**: `client/_ds_entry.tsx` re-exports the app's components as NAMED
  exports (aliasing the default-exported ones) so the converter can put each on
  `window.CeTeauUI.<Name>`. `cfg.entry` points at it; `PKG_DIR` resolves to `client/`
  (nearest named package.json). Gitignored + regenerable from `componentSrcMap`.
- **No `.d.ts` tree**, so the component list comes entirely from `cfg.componentSrcMap`
  (10 components). `srcDir: src/components` scopes enrichment/grouping.
- **Excluded**: `Layout.tsx` (empty `export {}` — component removed in Phase 2) and
  `layout/AgentModeChip.tsx` (deprecated `null` stub).
- **cssEntry = `client/ds-styles.css`**: a concatenation of the Vite app build's
  `dist/assets/*.css` (compiled Tailwind utilities + CeTeau design tokens from
  `src/styles/global.css` + page/component CSS like `.user-bubble`). Pointing at the
  raw `src/styles/global.css` would NOT work — its `@tailwind` directives are
  uncompiled there, so utility classes wouldn't exist.

## Component coupling (expected floor cards)
Most components depend on this app's stores (zustand), router (react-router-dom),
sockets, and `/api` calls, so they throw at render and ship as honest **floor cards**:
AgentEditor, AuthGate, ReactComponentRenderer, AppShell, ChatInputBar, Sidebar.
Standalone-renderable (authored previews): **Icon, UserMessageBubble, CopyButton, Toaster**.

## Global config decisions (this run)
- `cfg.provider = MemoryRouter` — `AppShell`/`Sidebar` call `useNavigate()` and floor-card
  without a router. `MemoryRouter` is re-exported from the barrel so it's a bundle export.
- `cfg.runtimeFontPrefixes` covers Google Sans / Noto Sans Thai / Roboto / Fira Code —
  the app loads them from the Google Fonts CDN at runtime (`<link>` in client/index.html);
  Google Sans is proprietary / not redistributable, so they are host-served, not shipped.
- The barrel also re-exports `notify` (the toast queue API) so the Toaster preview can seed
  toasts via the SAME module instance the bundle's Toaster subscribes to.
- `cfg.overrides.Toaster = {cardMode:single, viewport:460x340}` — its toasts are
  `position:fixed`, so they need a sized single card to anchor inside.

## Known render warns
- None. Render check is 10/10 clean. `ReactComponentRenderer` renders its genuine
  empty-`src` error state (not authored, not a floor card) — expected, not a warn.

## Re-sync gotcha
- The first `resync.mjs` invocation after a capture can transiently fail at the build stage
  (file lock from the just-finished chromium capture). Simply re-run it; the second run is clean.

## Re-sync risks / watch-list
- `client/ds-styles.css` is GENERATED from the app build and goes stale if the app is
  restyled. `cfg.buildCmd` regenerates it (`vite build` then concat the dist CSS).
  The dist CSS filenames are content-hashed — the `index-*.css`/`AgentEditor-*.css`
  globs in buildCmd handle the hash, but if Vite's chunking changes, revisit.
- Components are app-coupled; an upstream refactor of stores/router can change which
  ones render. Re-verify the authored set after any client refactor.
- Toaster renders `null` when its toast queue is empty — its preview must seed a toast
  (via the toast lib) or it collapses to nothing.
