// Phase 2 theme store. Binary light/dark only — no "system" auto-detect
// (per the Phase-2 design decision: simpler binary UX in the sidebar
// user pill). Default is "light". Persisted to localStorage under
// `ceteau:theme` and applied as `<html data-theme="…">` so the CSS
// token system in global.css picks it up.
//
// Coexists with Tailwind's `darkMode: ['class', '[data-theme="dark"]']`
// so utility classes like `dark:bg-bg-surface` also flip when the
// attribute toggles.

import { create } from "zustand";

export type Theme = "light" | "dark";

const KEY = "ceteau:theme";

function readInitial(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch { /* ignore SSR / disabled-storage contexts */ }
  return "light"; // Phase-2 default: Light
}

function apply(theme: Theme) {
  try {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    // Mirror as a class so Tailwind's `.dark:` variant works too.
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    localStorage.setItem(KEY, theme);
  } catch { /* ignore */ }
}

// Apply on module load so first paint reflects the persisted choice.
if (typeof window !== "undefined") {
  apply(readInitial());
}

interface ThemeState {
  theme: Theme;
  setTheme(t: Theme): void;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readInitial(),
  setTheme: (t) => { apply(t); set({ theme: t }); },
  toggle:   () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    apply(next);
    set({ theme: next });
  },
}));
