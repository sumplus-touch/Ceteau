// ─────────────────────────────────────────────────────────────────────
// ProjectDetailPage — Phase 3 base + Phase 4 chat-list rebuild
//
// Route: /project/:id  (separated from /project list in App.tsx).
//
// Layout:
//   • Top-left ← Back arrow returns to /project (the listing).
//   • Header: project name (left) + "Edit" button (right).
//   • Tab nav: Chat | Overview | Memory | Skills | Files.
//   • Pills row: yellow project short-code + green skill tags.
//
// Phase 4 — Chat tab is now a project-scoped CHAT LIST:
//   • "+ New Chat" button top-left → navigates to /?project={id}, so the
//     global ChatPage opens with the project chip pre-selected. When the
//     user types and sends, the backend uses `project:chat:send` and
//     loads the project's memory + skills + working folder context.
//   • Each chat row: stripped title, relative time, pin (★) toggle,
//     delete (×) on hover. Pinned float to top.
//   • Pin state is per-project in localStorage under
//     `ceteau:project-chat-pins:{projectId}` (no backend changes).
//
// Backend untouched. Memory/Skills/Files tabs still talk to existing
// /api/projects/:id/* endpoints.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Edit2, MessageSquarePlus, MessageSquare, Download,
  Save, Wand2, FolderOpen, Upload, FolderPlus, Trash2, ChevronRight,
  Loader2, Star, X as XIcon,
} from "lucide-react";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { api } from "../utils/api";
import { useProjectsStore } from "../store/projects";
import { ProjectFormModal } from "./ProjectsPage";

// Phase 4: per-project chat pin state lives in localStorage. Keyed by
// project id so each project has its own pinned set. Same approach the
// projects store uses for project pinning — no backend changes.
const CHAT_PIN_KEY_PREFIX = "ceteau:project-chat-pins:";

function readChatPins(projectId: string): Set<string> {
  try {
    const raw = localStorage.getItem(CHAT_PIN_KEY_PREFIX + projectId);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch { return new Set(); }
}

function writeChatPins(projectId: string, pins: Set<string>) {
  try {
    localStorage.setItem(CHAT_PIN_KEY_PREFIX + projectId, JSON.stringify([...pins]));
  } catch { /* ignore */ }
}

// ── Types matching backend shape ─────────────────────────────────────
interface Project {
  id: string;
  name: string;
  description?: string;
  workingFolder?: string;
  memory?: string;
  skills?: string[];
  updatedAt?: string;
  createdAt?: string;
  [key: string]: any;
}
interface Skill { id: string; name: string; description?: string; [k: string]: any; }
interface Session { id: string; title: string; updatedAt?: string; createdAt?: string; }
interface FileEntry { name: string; isDirectory: boolean; size: number; path: string; }

type Tab = "chat" | "overview" | "memory" | "skills" | "files";

// ── Helpers ──────────────────────────────────────────────────────────
function shortCode(name: string): string {
  return (name || "PRJ").trim().slice(0, 5).toUpperCase();
}
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatRelative(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────
// ── Chat tab — Phase 4 rebuild ──────────────────────────────────────
// Was: two-column compose panel that handed off to /chat/:id.
// Now: a full-width LIST of every chat that belongs to this project
//      (sessions whose title starts with `[ProjectName]`). The user
//      clicks a row to open it in the global chat page, pins/unpins
//      rows (localStorage), and starts new chats by clicking the top-
//      left "+ New Chat" button which navigates to /?project={id} so
//      the global chat opens with the project chip pre-selected.
// ─────────────────────────────────────────────────────────────────────
function ChatTab({ project }: { project: Project }) {
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [pins, setPins] = useState<Set<string>>(() => readChatPins(project.id));

  async function loadSessions() {
    setLoading(true);
    try {
      const all: Session[] = await api.getSessions();
      const prefix = `[${project.name}]`;
      setSessions((all || []).filter((s) => s.title?.startsWith(prefix)));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { loadSessions(); /* eslint-disable-next-line */ }, [project.id, project.name]);

  // Reload pins when the project id changes (each project has its own
  // pinned set in localStorage).
  useEffect(() => { setPins(readChatPins(project.id)); }, [project.id]);

  function togglePin(id: string) {
    const next = new Set(pins);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPins(next);
    writeChatPins(project.id, next);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this chat? This cannot be undone.")) return;
    try {
      await api.deleteSession(id);
      // Remove from pin set if pinned (no orphan pins)
      if (pins.has(id)) {
        const next = new Set(pins);
        next.delete(id);
        setPins(next);
        writeChatPins(project.id, next);
      }
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err?.message || "Failed to delete chat");
    }
  }

  // Sort: pinned rows first (by updatedAt desc), then the rest (also
  // by updatedAt desc). The prefix is stripped for display only.
  const sorted = useMemo(() => {
    const byRecent = (a: Session, b: Session) => {
      const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bd - ad;
    };
    const pinned = sessions.filter((s) => pins.has(s.id)).sort(byRecent);
    const rest = sessions.filter((s) => !pins.has(s.id)).sort(byRecent);
    return { pinned, rest };
  }, [sessions, pins]);

  // Stripped-title helper — the `[ProjectName] ` prefix is redundant
  // here since the user is already inside that project.
  const prefix = `[${project.name}]`;
  function displayTitle(t?: string): string {
    if (!t) return "Untitled";
    return t.startsWith(prefix) ? (t.slice(prefix.length).trim() || "Untitled") : t;
  }

  // Reusable row renderer keeps pinned & recent sections consistent.
  function ChatRow({ s }: { s: Session }) {
    const isPinned = pins.has(s.id);
    return (
      <div
        className="group flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-bg-surface hover:border-accent/40 hover:bg-fg-base/[0.02] transition-colors duration-150"
      >
        <button
          type="button"
          onClick={() => navigate(`/chat/${s.id}`)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <MessageSquare size={12} className="shrink-0 opacity-60 text-fg-subtle" />
          <span className="truncate text-sm text-fg-base">{displayTitle(s.title)}</span>
          <span className="ml-auto text-[10px] text-fg-subtle shrink-0">
            {formatRelative(s.updatedAt || s.createdAt)}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); togglePin(s.id); }}
          title={isPinned ? "Unpin" : "Pin"}
          aria-label={isPinned ? "Unpin chat" : "Pin chat"}
          className={clsx(
            "p-1 rounded transition-colors duration-150",
            isPinned
              ? "text-yellow-500 hover:bg-yellow-500/10"
              : "opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-yellow-500 hover:bg-fg-base/5",
          )}
        >
          <Star size={12} fill={isPinned ? "currentColor" : "none"} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
          title="Delete chat"
          aria-label="Delete chat"
          className="opacity-0 group-hover:opacity-100 p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5 transition-colors duration-150"
        >
          <XIcon size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Top row — Phase 4 fix P2: count on the LEFT, "+ New Chat" on
            the RIGHT. */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] text-fg-subtle">
            {sessions.length} {sessions.length === 1 ? "chat" : "chats"}
          </span>
          <button
            type="button"
            onClick={() => navigate(`/?project=${encodeURIComponent(String(project.id))}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors duration-150"
          >
            <MessageSquarePlus size={13} />
            New Chat
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-fg-subtle text-sm">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <MessageSquare size={28} className="mx-auto text-fg-subtle mb-3" />
            <p className="text-sm text-fg-muted mb-1">No chats yet</p>
            <p className="text-xs text-fg-subtle mb-4">
              Start a new chat — the agent will see this project's memory, skills, and working folder.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/?project=${encodeURIComponent(String(project.id))}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90"
            >
              <MessageSquarePlus size={12} /> Start your first chat
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.pinned.length > 0 && (
              <div>
                <h3 className="text-[10px] uppercase tracking-wider text-fg-subtle font-semibold mb-2 px-1">
                  Pinned
                </h3>
                <div className="space-y-1.5">
                  {sorted.pinned.map((s) => <ChatRow key={s.id} s={s} />)}
                </div>
              </div>
            )}
            {sorted.rest.length > 0 && (
              <div>
                {sorted.pinned.length > 0 && (
                  <h3 className="text-[10px] uppercase tracking-wider text-fg-subtle font-semibold mb-2 px-1">
                    Recent
                  </h3>
                )}
                <div className="space-y-1.5">
                  {sorted.rest.map((s) => <ChatRow key={s.id} s={s} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ── Overview tab ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
function OverviewTab({ project }: { project: Project }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="rounded-xl border border-border bg-bg-surface p-5">
          <h3 className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Description</h3>
          <p className="text-sm text-fg-base whitespace-pre-wrap">
            {project.description || <span className="text-fg-subtle italic">No description yet. Click Edit in the header to add one.</span>}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-bg-surface p-5">
            <h3 className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Working Folder</h3>
            <p className="text-sm text-fg-base font-mono break-all">
              {project.workingFolder || <span className="text-fg-subtle italic">Not set</span>}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg-surface p-5">
            <h3 className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Skills</h3>
            <p className="text-sm text-fg-base">
              {project.skills?.length
                ? `${project.skills.length} enabled`
                : <span className="text-fg-subtle italic">None selected</span>}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg-surface p-5">
            <h3 className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Created</h3>
            <p className="text-sm text-fg-base">{formatRelative(project.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-border bg-bg-surface p-5">
            <h3 className="text-xs uppercase tracking-wider text-fg-subtle font-semibold mb-2">Last Updated</h3>
            <p className="text-sm text-fg-base">{formatRelative(project.updatedAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ── Memory tab ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
function MemoryTab({ project }: { project: Project }) {
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let mounted = true;
    api.getProjectMemory(project.id).then((data: any) => {
      if (!mounted) return;
      setContent(data?.content || "");
      setLoaded(true);
    }).catch(() => setLoaded(true));
    return () => { mounted = false; };
  }, [project.id]);

  async function save() {
    setSaving(true);
    try {
      await api.saveProjectMemory(project.id, content);
      setEditing(false);
    } catch (err: any) {
      alert(err?.message || "Failed to save memory");
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!confirm("Generate project memory from chat history? This may overwrite your current notes.")) return;
    setGenerating(true);
    try {
      const result: any = await api.generateProjectMemory(project.id);
      if (result?.content) {
        setContent(result.content);
        setEditing(true);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to generate memory");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col p-6">
      <div className="max-w-3xl w-full mx-auto flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-fg-base">Project Memory</h3>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-md text-xs text-fg-muted hover:bg-fg-base/5"
              >Cancel</button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                <Save size={11} /> {saving ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-fg-muted border border-border hover:text-fg-base hover:border-accent/40 disabled:opacity-50"
              >
                <Wand2 size={11} /> {generating ? "Generating…" : "Generate from chat"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-fg-muted border border-border hover:text-fg-base hover:border-accent/40"
              >
                <Edit2 size={11} /> Edit
              </button>
            </>
          )}
        </div>
      </div>

      {!loaded ? (
        <div className="flex-1 flex items-center justify-center text-fg-subtle text-sm">
          <Loader2 size={14} className="animate-spin mr-2" /> Loading…
        </div>
      ) : editing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 min-h-0 w-full p-4 rounded-xl border border-border bg-bg-surface text-sm text-fg-base font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          placeholder="Notes, conventions, decisions… (Markdown)"
        />
      ) : content ? (
        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-border bg-bg-surface p-5">
          <div className="text-sm text-fg-base leading-relaxed memory-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <p className="text-sm text-fg-muted mb-3">No memory yet</p>
            <p className="text-xs text-fg-subtle mb-4">
              Project memory is a Markdown document the agent reads at the start of every chat.
              Write notes, conventions, and key decisions here.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90"
            >
              <Edit2 size={11} /> Start writing
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ── Skills tab ──────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
function SkillsTab({ project, onProjectChange }: { project: Project; onProjectChange: (p: Project) => void }) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [loaded, setLoaded] = useState(false);
  const enabledSet = useMemo(() => new Set(project.skills || []), [project.skills]);

  useEffect(() => {
    api.getSkills().then((data: any) => {
      setAllSkills(Array.isArray(data) ? data : (data?.skills || []));
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, []);

  async function toggleSkill(id: string) {
    const next = new Set(enabledSet);
    if (next.has(id)) next.delete(id); else next.add(id);
    try {
      const updated = await api.updateProject(project.id, { skills: [...next] });
      onProjectChange(updated);
    } catch (err: any) {
      alert(err?.message || "Failed to update skills");
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h3 className="text-sm font-semibold text-fg-base mb-1">Skills</h3>
        <p className="text-xs text-fg-muted mb-4">
          Select which skills are available to the agent in this project's chats.
        </p>
        {!loaded ? (
          <div className="flex items-center gap-2 text-fg-subtle text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading skills…
          </div>
        ) : allSkills.length === 0 ? (
          <p className="text-sm text-fg-subtle italic">No skills installed</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {allSkills.map((s) => {
              const on = enabledSet.has(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSkill(s.id)}
                  className={clsx(
                    "text-left rounded-lg border p-3 transition-colors duration-150",
                    on
                      ? "border-accent/40 bg-accent/[0.06]"
                      : "border-border bg-bg-surface hover:border-fg-base/20",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={clsx(
                      "mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                      on ? "bg-accent border-accent" : "border-border bg-bg-base",
                    )}>
                      {on && <span className="text-white text-[9px] leading-none">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx("text-sm font-medium truncate", on ? "text-accent" : "text-fg-base")}>
                        {s.name}
                      </p>
                      {s.description && (
                        <p className="text-[11px] text-fg-subtle mt-0.5 line-clamp-2">{s.description}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ── Files tab ───────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
function FilesTab({ project, onEdit }: { project: Project; onEdit: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [subPath, setSubPath] = useState("");
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    if (!project.workingFolder) return;
    setLoading(true);
    try {
      const data: any = await api.getProjectFiles(project.id, subPath);
      setFiles(data?.files || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [project.id, subPath]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.projectUploadFile(project.id, file, subPath);
      await load();
    } catch (err: any) {
      alert(err?.message || "Upload failed");
    }
    e.target.value = "";
  }

  async function handleMkdir() {
    if (!mkdirName.trim()) return;
    try {
      // mkdir endpoint
      await fetch(`/api/projects/${project.id}/files/mkdir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: mkdirName.trim(), path: subPath }),
      });
      setMkdirOpen(false);
      setMkdirName("");
      await load();
    } catch (err: any) {
      alert(err?.message || "Failed to create folder");
    }
  }

  async function handleDelete(f: FileEntry) {
    if (!confirm(`Delete "${f.name}"?`)) return;
    try {
      await api.projectDeleteFile(project.id, f.path);
      await load();
    } catch (err: any) {
      alert(err?.message || "Delete failed");
    }
  }

  const crumbs = subPath ? subPath.split("/").filter(Boolean) : [];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* P5: header is always present, matching the old Tiger Cowork
            Files layout. When no folder is set, the heading shows
            alone above an empty-state with a clickable "Set working
            folder" button that opens the Edit modal. */}
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-fg-base">Working Folder</h3>
          {project.workingFolder && (
            <span className="text-[11px] text-fg-subtle font-mono truncate ml-3 max-w-[60%]">
              {project.workingFolder}
            </span>
          )}
        </div>

        {!project.workingFolder ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-fg-muted mb-3">No working folder set.</p>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium text-fg-base border border-border hover:border-accent/40 hover:text-accent transition-colors duration-150"
            >
              Set working folder
            </button>
          </div>
        ) : (
        <div>
        {/* Toolbar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 flex items-center gap-1 text-xs text-fg-muted">
            <button
              type="button"
              onClick={() => setSubPath("")}
              className="hover:text-fg-base"
            >
              <FolderOpen size={12} className="inline" /> root
            </button>
            {crumbs.map((seg, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight size={10} className="opacity-50" />
                <button
                  type="button"
                  onClick={() => setSubPath(crumbs.slice(0, i + 1).join("/"))}
                  className="hover:text-fg-base"
                >{seg}</button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-fg-muted border border-border hover:text-fg-base hover:border-accent/40"
          >
            <Upload size={11} /> Upload
          </button>
          <button
            type="button"
            onClick={() => setMkdirOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs text-fg-muted border border-border hover:text-fg-base hover:border-accent/40"
          >
            <FolderPlus size={11} /> New Folder
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>

        {mkdirOpen && (
          <div className="mb-3 flex items-center gap-2 p-3 rounded-lg border border-border bg-bg-surface">
            <input
              autoFocus
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMkdir(); }}
              placeholder="Folder name"
              className="flex-1 px-2.5 py-1.5 rounded-md border border-border bg-bg-base text-xs text-fg-base placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <button type="button" onClick={handleMkdir} className="px-3 py-1.5 rounded-md bg-accent text-white text-xs">Create</button>
            <button type="button" onClick={() => setMkdirOpen(false)} className="px-3 py-1.5 rounded-md text-xs text-fg-muted hover:bg-fg-base/5">Cancel</button>
          </div>
        )}

        {/* File list */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-fg-subtle text-sm">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading…
          </div>
        ) : files.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-sm text-fg-muted">This folder is empty</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {files.map((f) => (
              <div
                key={f.path}
                className="group flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-fg-base/[0.02] transition-colors duration-150"
              >
                <button
                  type="button"
                  onClick={() => { if (f.isDirectory) setSubPath(f.path); }}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                  disabled={!f.isDirectory}
                >
                  <FolderOpen
                    size={12}
                    className={clsx("shrink-0", f.isDirectory ? "text-accent" : "text-fg-subtle")}
                  />
                  <span className="text-sm text-fg-base truncate">{f.name}</span>
                </button>
                <span className="text-[11px] text-fg-subtle shrink-0">
                  {f.isDirectory ? "—" : formatSize(f.size)}
                </span>
                {!f.isDirectory && (
                  <a
                    href={api.projectDownloadUrl(project.id, f.path)}
                    download
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-fg-subtle hover:text-accent hover:bg-fg-base/5"
                    title="Download"
                  >
                    <Download size={11} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(f)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ── Main page orchestrator ──────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const loadProjects = useProjectsStore((s) => s.loadProjects);

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");
  const [editing, setEditing] = useState(false);

  // P4: load all skills once at the page level so the pills row can map
  // each project.skills[i] ID → friendly name (was rendering raw IDs).
  const [skillsMap, setSkillsMap] = useState<Record<string, string>>({});
  useEffect(() => {
    api.getSkills().then((data: any) => {
      const arr = Array.isArray(data) ? data : (data?.skills || []);
      const map: Record<string, string> = {};
      for (const s of arr) map[s.id] = s.name || s.id;
      setSkillsMap(map);
    }).catch(() => { /* leave empty; pills fall back to raw IDs */ });
  }, []);

  // Load the project on mount / id change.
  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    api.getProject(id).then((p: any) => {
      if (!mounted) return;
      setProject(p);
    }).catch(() => {
      if (mounted) setProject(null);
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-fg-subtle">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-fg-muted mb-3">Project not found</p>
          <button
            type="button"
            onClick={() => navigate("/project")}
            className="px-4 py-2 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90"
          >
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "chat",     label: "Chat" },
    { key: "overview", label: "Overview" },
    { key: "memory",   label: "Memory" },
    { key: "skills",   label: "Skills" },
    { key: "files",    label: "Files" },
  ];

  const code = shortCode(project.name);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-bg-base">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-2 shrink-0">
        <button
          type="button"
          onClick={() => navigate("/project")}
          className="inline-flex items-center gap-1.5 text-xs text-fg-muted hover:text-fg-base mb-2"
        >
          <ArrowLeft size={12} /> Back to projects
        </button>
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-fg-base truncate">{project.name}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-fg-muted border border-border hover:text-fg-base hover:border-accent/40 transition-colors duration-150 shrink-0"
          >
            <Edit2 size={11} /> Edit
          </button>
        </div>
      </div>

      {/* ── Tab nav ────────────────────────────────────────────── */}
      <div className="px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={clsx(
                "px-4 py-2 text-xs font-medium rounded-t-md transition-colors duration-150",
                tab === t.key
                  ? "bg-accent/10 text-accent border-b-2 border-accent -mb-px"
                  : "text-fg-muted hover:text-fg-base hover:bg-fg-base/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pills row (yellow short-code + green skill pills) ─── */}
      <div className="px-6 py-2 border-b border-border shrink-0 flex items-center gap-2 overflow-x-auto">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-yellow-400/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30 shrink-0">
          {code}
        </span>
        {project.skills?.length ? (
          project.skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 shrink-0"
              title={s}
            >
              {skillsMap[s] || s}
            </span>
          ))
        ) : (
          <span className="text-[10px] text-fg-subtle italic">No skills selected</span>
        )}
      </div>

      {/* ── Tab content ────────────────────────────────────────── */}
      {tab === "chat" && <ChatTab project={project} />}
      {tab === "overview" && <OverviewTab project={project} />}
      {tab === "memory" && <MemoryTab project={project} />}
      {tab === "skills" && <SkillsTab project={project} onProjectChange={setProject} />}
      {tab === "files" && <FilesTab project={project} onEdit={() => setEditing(true)} />}

      {/* Edit modal — same modal as Create, pre-filled */}
      <ProjectFormModal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit Project"
        initial={{
          id: project.id,
          name: project.name,
          description: project.description,
          workingFolder: project.workingFolder,
        }}
        onSaved={async (p) => {
          setProject(p as any);
          await loadProjects();
        }}
      />
    </div>
  );
}
