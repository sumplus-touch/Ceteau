/** @type {import('tailwindcss').Config} */
//
// Phase 1 — Tailwind foundation for CeTeau AI.
//
// Tailwind utilities resolve through our existing CSS custom properties
// declared in src/styles/global.css. The `rgb(var(--…-rgb) / <alpha>)`
// pattern lets utility classes (e.g. `bg-accent/15`) work while the
// underlying token value still flips between light and dark mode via
// the [data-theme="dark"] attribute on <html>.
//
// Naming convention mirrors the agentflow reference codebase so any
// cloned components in Phase 2+ can keep their existing class names
// without rewriting (`bg-bg-surface`, `text-fg-muted`, `text-accent`,
// `border-border-base`, etc.) and still resolve to OUR CeTeau tokens.
//
// CRITICAL: `corePlugins.preflight = false` disables Tailwind's CSS
// reset. The reset would override our existing button/heading/list
// styles and break the Phase-1 visual-equivalence guarantee. We can
// enable it in a future pass if we decide to migrate fully.

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  // Both selector forms work — our existing data-attribute system AND
  // a future `.dark` class. Cloned agentflow components that toggle
  // <html class="dark"> will pick this up automatically.
  darkMode: ["class", '[data-theme="dark"]'],

  corePlugins: {
    // Phase-1 safety: don't reset existing styles. Re-enable later
    // only after we've audited what would change.
    preflight: false,
  },

  theme: {
    extend: {
      fontFamily: {
        sans: ["Google Sans", "Noto Sans Thai", "Roboto", "system-ui", "sans-serif"],
        mono: ["Roboto Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Backgrounds — agentflow nomenclature mapped to OUR tokens.
        //   bg-base    = page canvas (our --bg-secondary)
        //   bg-surface = cards / elevated surfaces (our --bg-primary)
        //   bg-sunken  = sub-surface / hover backdrop (our --bg-tertiary)
        bg: {
          base:    "rgb(var(--bg-secondary-rgb) / <alpha-value>)",
          surface: "rgb(var(--bg-primary-rgb)   / <alpha-value>)",
          sunken:  "rgb(var(--bg-tertiary-rgb)  / <alpha-value>)",
        },

        // Text — agentflow nomenclature.
        //   fg-base   = primary text (our --text-primary)
        //   fg-muted  = secondary text (our --text-secondary)
        //   fg-subtle = placeholder / disabled (our --text-tertiary)
        fg: {
          base:   "rgb(var(--text-primary-rgb)   / <alpha-value>)",
          muted:  "rgb(var(--text-secondary-rgb) / <alpha-value>)",
          subtle: "rgb(var(--text-tertiary-rgb)  / <alpha-value>)",
        },

        // Brand accent — CeTeau Blue. Flips to electric blue in dark
        // mode because --accent-rgb is overridden in [data-theme="dark"].
        accent: {
          DEFAULT: "rgb(var(--accent-rgb) / <alpha-value>)",
          soft:    "rgb(var(--accent-rgb) / 0.10)",
        },

        // Borders. Both names resolve to the same token; agentflow's
        // `border-border-base` and bare `border-border` patterns both
        // need to work.
        border:          "rgb(var(--border-rgb) / <alpha-value>)",
        "border-base":   "rgb(var(--border-rgb) / <alpha-value>)",
        "border-strong": "rgb(var(--border-rgb) / <alpha-value>)",

        // Semantic states. Universal across light/dark.
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        error:   "rgb(var(--error-rgb)   / <alpha-value>)",
      },

      // Type scale matching the agentflow brand spec so cloned
      // components' .text-h1 / .text-body classes resolve.
      fontSize: {
        h1:        ["32px", { lineHeight: "1.2",  fontWeight: "700" }],
        h2:        ["24px", { lineHeight: "1.25", fontWeight: "600" }],
        h3:        ["18px", { lineHeight: "1.3",  fontWeight: "500" }],
        body:      ["16px", { lineHeight: "1.5",  fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5",  fontWeight: "400" }],
        caption:   ["12px", { lineHeight: "1.4",  fontWeight: "500" }],
      },
    },
  },

  plugins: [],
};
