// Phase 2 projects store. Wraps our existing /api/projects routes
// and tracks pinning state CLIENT-SIDE via localStorage (per the
// Phase-2 design decision: no backend changes for pinning).
//
// The Sidebar reads `projects` (with .is_pinned synthesized from the
// localStorage Set) so it can render the Pinned section. Pin state
// survives reloads but doesn't sync across browsers or devices —
// acceptable for a single-user tool, can be promoted to a server
// field in a future phase if needed.

import { create } from "zustand";
import { api } from "../utils/api";

export interface Project {
  id: number | string;
  name: string;
  description?: string;
  is_pinned?: boolean;
  // pass-through for any other backend fields
  [key: string]: any;
}

const PIN_KEY = "ceteau:pinned-projects";

function readPinSet(): Set<string> {
  try {
    const raw = localStorage.getItem(PIN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch { return new Set(); }
}

function writePinSet(s: Set<string>) {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify([...s]));
  } catch { /* ignore */ }
}

function decorate(raw: Project[], pins: Set<string>): Project[] {
  return raw.map((p) => ({ ...p, is_pinned: pins.has(String(p.id)) }));
}

interface ProjectsState {
  projects: Project[];
  loaded: boolean;
  loading: boolean;
  loadProjects(): Promise<void>;
  togglePin(id: number | string): void;
}

// Phase 4 recheck: request token (same pattern as conversations store)
// — guards against stale responses but doesn't drop concurrent calls.
let _loadToken = 0;

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  loaded: false,
  loading: false,

  loadProjects: async () => {
    const myToken = ++_loadToken;
    set({ loading: true });
    try {
      const raw: Project[] = await api.getProjects();
      if (myToken !== _loadToken) return;
      const pins = readPinSet();
      set({ projects: decorate(raw || [], pins), loaded: true, loading: false });
    } catch (err) {
      if (myToken === _loadToken) set({ loading: false });
      console.error("[projects store] load failed:", err);
    }
  },

  togglePin: (id) => {
    const key = String(id);
    const pins = readPinSet();
    if (pins.has(key)) pins.delete(key); else pins.add(key);
    writePinSet(pins);
    set({ projects: get().projects.map((p) => String(p.id) === key ? { ...p, is_pinned: pins.has(key) } : p) });
  },
}));
