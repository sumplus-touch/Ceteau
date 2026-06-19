# CeTeau AI UI — conventions for building with this library

This is the component set from the CeTeau AI ("cowork") app. Components are real,
compiled React exports on `window.CeTeauUI`. Build on-brand UI by reusing them and
styling your own layout glue with the CeTeau **design tokens** below.

## Styling: use the CeTeau design tokens (CSS custom properties)

The brand is expressed as CSS custom properties that are **always defined** in the
shipped stylesheet — they resolve everywhere, in light and dark mode. Prefer them
(via inline `style`) for any markup you write:

- Surfaces: `var(--bg-primary)` (cards/surfaces), `var(--bg-secondary)` (page canvas),
  `var(--bg-tertiary)` (subtle hover), `var(--bg-hover)`.
- Text: `var(--text-primary)`, `var(--text-secondary)` (muted), `var(--text-tertiary)`
  (placeholder/disabled).
- Brand accent — **CeTeau Blue**: `var(--accent)` (#0073C2), `var(--accent-hover)`,
  `var(--accent-light)`, `var(--accent-bg)` (tinted backdrop).
- Lines: `var(--border)`.
- Semantic states: `var(--success)`, `var(--warning)`, `var(--error)`.
- Status pills: `var(--pill-info-bg|fg)`, `--pill-success-*`, `--pill-warning-*`,
  `--pill-danger-*`.
- Type: font families `"Google Sans", "Noto Sans Thai", "Roboto"` (sans) and
  `"Roboto Mono"` (mono). These load at runtime from Google Fonts — include the host's
  `<link>` to `fonts.googleapis.com`, otherwise they fall back to system fonts.

Dark mode flips every token: set `data-theme="dark"` on `<html>` (the library also
honors Tailwind's `dark`/`[data-theme="dark"]` selectors).

## Tailwind token utilities — ONLY this pre-compiled set

The app uses a Tailwind preset that maps utility classes onto the tokens. **There is no
Tailwind JIT at render time**, so only classes the app already compiled are available.
Safe to use (verified present in the shipped CSS):
`bg-bg-base`, `bg-bg-surface`, `text-fg-base`, `text-fg-muted`, `text-fg-subtle`,
`bg-accent`, `text-accent`, `border-border`, `bg-success`/`text-success`/`border-success`,
`bg-warning`/`text-warning`, `bg-error`/`text-error` (plus opacity modifiers like
`bg-success/10`, `border-error/40`).

Do NOT invent other token utilities (`bg-bg-sunken`, `text-h1`, `text-body`, `bg-accent-soft`
are NOT compiled and will silently do nothing). For anything outside the list above,
use the `var(--*)` token via inline `style` instead.

## Setup notes

- **Toasts**: mount `<Toaster />` once at the app root, then call
  `notify.success(msg)` / `.error` / `.warning` / `.info` from anywhere — it's a global
  queue, no provider needed.
- **Router-dependent components** (`AppShell`, `Sidebar`) call `useNavigate()`, so they
  must render inside a react-router `<MemoryRouter>`/`<BrowserRouter>`.
- **AuthGate** wraps children behind an access-token gate; pass real children.

## Where the truth lives
Read `styles.css` (and its `@import "./_ds_bundle.css"`) for the full token + class set,
and each component's `<Name>.d.ts` (its prop contract) and `<Name>.prompt.md` (usage)
before composing it.

## One idiomatic snippet
```jsx
import { UserMessageBubble, CopyButton, Toaster, notify } from "cowork-client";

function ChatTurn({ text }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end",
                  gap: 6, padding: 16, background: "var(--bg-secondary)" }}>
      <UserMessageBubble content={text} />
      <div className="bg-bg-surface" style={{ borderRadius: 8 }}>
        <CopyButton text={text} />
      </div>
      <Toaster />
    </div>
  );
}
```
