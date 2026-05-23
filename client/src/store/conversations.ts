// Phase 2 conversations store. Wraps our existing /api/chat/sessions
// routes and tracks pin state CLIENT-SIDE via localStorage. The
// Sidebar uses this to render the PINNED + RECENTS sections with
// drag-to-pin behavior.
//
// Pin state never touches the backend — same trade-off as the projects
// store. Pins are per-browser; survive reloads but not multi-device.

import { create } from "zustand";
import { api } from "../utils/api";

export interface Conversation {
  id: number | string;
  title: string;
  // pass-through for any other backend fields
  [key: string]: any;
}

const PIN_KEY = "ceteau:pinned-conversations";

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

interface ConversationsState {
  conversations: Conversation[];
  pinnedIds: (number | string)[];
  loaded: boolean;
  loading: boolean;
  loadConversations(): Promise<void>;
  deleteConversation(id: number | string): Promise<void>;
  setPin(id: number | string, pinned: boolean): void;
}

// Phase 4 recheck: request token guards against stale responses
// overwriting fresh state. Each call increments the token; only the
// response whose token still matches the latest gets to call `set`.
// This replaces the old `if (loading) return` short-circuit which
// silently dropped refreshes triggered from ChatPage.handleSend right
// after sidebar mount-load (the "chat doesn't show in recent" bug).
let _loadToken = 0;

export const useConversationsStore = create<ConversationsState>((set, get) => ({
  conversations: [],
  pinnedIds: [...readPinSet()],
  loaded: false,
  loading: false,

  loadConversations: async () => {
    const myToken = ++_loadToken;
    set({ loading: true });
    try {
      const raw: Conversation[] = await api.getSessions();
      if (myToken !== _loadToken) return; // a newer load is in flight; skip
      const normalized = (raw || []).map((c: any) => ({
        ...c,
        id: c.id,
        title: c.title || "Untitled chat",
      }));
      set({ conversations: normalized, loaded: true, loading: false });
    } catch (err) {
      if (myToken === _loadToken) set({ loading: false });
      console.error("[conversations store] load failed:", err);
    }
  },

  deleteConversation: async (id) => {
    // Optimistic: remove from local list before the network call.
    const before = get().conversations;
    set({ conversations: before.filter((c) => String(c.id) !== String(id)) });

    // P5: kill any active task on this session before deleting so the
    // backend doesn't keep working on a chat that no longer exists.
    // The active-tasks endpoint returns tasks for ALL sessions; we
    // filter and kill the ones bound to this conversation.
    try {
      const tasks: any[] = await api.getActiveTasks();
      const sessionTaskIds = (tasks || [])
        .filter((t) => String(t.sessionId) === String(id))
        .map((t) => String(t.id));
      await Promise.all(sessionTaskIds.map((tid) =>
        api.killActiveTask(tid).catch(() => { /* swallow */ })
      ));
    } catch { /* ignore — kill attempt is best-effort */ }

    try {
      await api.deleteSession(String(id));
      // P8: re-sync with backend after delete so any persistence
      // failure becomes visible immediately (rather than after a
      // page refresh). If the delete didn't actually take, the
      // session reappears here and the user can retry.
      try {
        const fresh: Conversation[] = await api.getSessions();
        set({ conversations: (fresh || []).map((c: any) => ({
          ...c, id: c.id, title: c.title || "Untitled chat",
        })) });
      } catch { /* ignore — keep optimistic state */ }
    } catch (err) {
      // Roll back on failure.
      console.error("[conversations store] delete failed, restoring:", err);
      set({ conversations: before });
    }
  },

  setPin: (id, pinned) => {
    const key = String(id);
    const pins = readPinSet();
    if (pinned) pins.add(key); else pins.delete(key);
    writePinSet(pins);
    set({ pinnedIds: [...pins] });
  },
}));
