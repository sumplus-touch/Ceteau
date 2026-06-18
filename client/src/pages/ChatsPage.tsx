// ─────────────────────────────────────────────────────────────────────
// ChatsPage — full list of all chat history.
//
// Route: /chats. Reached via the "View all" link next to the sidebar's
// RECENTS header. Lists every conversation (click to open, search,
// delete), reusing the existing conversations store — no backend changes.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, MessageSquare, Search, Trash2 } from "lucide-react";
import { useConversationsStore } from "../store/conversations";

// Relative-time helper (same shape as ProjectsPage's).
function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function ChatsPage() {
  const navigate = useNavigate();
  const conversations     = useConversationsStore((s) => s.conversations);
  const loaded            = useConversationsStore((s) => s.loaded);
  const loadConversations = useConversationsStore((s) => s.loadConversations);
  const deleteConversation = useConversationsStore((s) => s.deleteConversation);

  const [query, setQuery] = useState("");

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = conversations.slice();
    if (q) list = list.filter((c) => (c.title || "").toLowerCase().includes(q));
    // Most-recently-updated first (falls back to createdAt, then leaves order).
    list.sort((a, b) => {
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return bd - ad;
    });
    return list;
  }, [conversations, query]);

  async function handleDelete(id: number | string, title: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete chat "${title}"? This cannot be undone.`)) return;
    await deleteConversation(id);
  }

  const isEmpty = loaded && conversations.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-base">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {isEmpty ? (
          /* ── Empty state ──────────────────────────────────────── */
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <h1 className="text-3xl font-bold text-fg-base mb-3">All Chats</h1>
              <p className="text-sm text-fg-muted mb-6 leading-relaxed">
                You don't have any conversations yet. Start a new chat and it
                will show up here.
              </p>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors duration-150 shadow-sm"
              >
                <Plus size={15} />
                Start a new chat
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-fg-base">All Chats</h1>
                <p className="text-xs text-fg-muted mt-0.5">
                  {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-44 pl-7 pr-3 py-1.5 rounded-md border border-border bg-bg-surface text-xs text-fg-base placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                  />
                </div>
                {/* + New chat */}
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors duration-150"
                >
                  <Plus size={13} />
                  New chat
                </button>
              </div>
            </div>

            {/* ── Body — chat list ───────────────────────────────── */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <p className="text-sm text-fg-muted">No chats match "{query}"</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/chat/${c.id}`)}
                    className="group w-full text-left rounded-lg border border-border bg-bg-surface hover:border-accent/40 hover:bg-fg-base/[0.02] transition-all duration-150 px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                      <MessageSquare size={14} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-fg-base truncate">{c.title || "Untitled chat"}</h3>
                      {typeof c.messageCount === "number" && (
                        <p className="text-xs text-fg-muted truncate">
                          {c.messageCount} {c.messageCount === 1 ? "message" : "messages"}
                        </p>
                      )}
                    </div>
                    <div className="text-[11px] text-fg-subtle shrink-0">
                      {formatRelative(c.updatedAt || c.createdAt)}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(c.id, c.title || "Untitled chat", e)}
                        className="p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5"
                        title="Delete chat"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
