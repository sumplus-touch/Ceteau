// ─────────────────────────────────────────────────────────────────────
// ProjectsPage — Phase 3 redesign
//
// Route: /project (the listing).  Detail view (/project/:id) lives in
// ProjectDetailPage.tsx; both are routed independently in App.tsx.
//
// What changed in Phase 3:
//   • Removed the nested project-list "sidebar" column. The page is
//     now a single content area inside the global CeTeau sidebar.
//   • Grid / List view toggle (localStorage-persisted, default Grid).
//   • Sort: A-Z / Recent pills (localStorage-persisted).
//   • "+ New Project" opens a CENTERED MODAL (was inline form).
//   • Empty state matches the agentflow + CeTeau hybrid the user
//     approved: big headline + body copy + primary CTA.
//   • Clicking a project card navigates to /project/:id.
//
// Backend untouched — uses existing /api/projects endpoints only.
// ─────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, FolderOpen, LayoutGrid, List as ListIcon, Search, X,
  Trash2, Pin, PinOff,
} from "lucide-react";
import clsx from "clsx";
import { useProjectsStore, type Project } from "../store/projects";
import { api } from "../utils/api";

const VIEW_KEY = "ceteau:projects-view";
const SORT_KEY = "ceteau:projects-sort";

type ViewMode = "grid" | "list";
type SortMode = "az" | "recent";

// ── Helpers ──────────────────────────────────────────────────────────
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

// ── Create / Edit modal — shared shape, reused by detail page too ──
export function ProjectFormModal({
  open, onClose, initial, onSaved, title = "New Project",
}: {
  open: boolean;
  onClose: () => void;
  initial?: { name?: string; description?: string; workingFolder?: string; id?: string };
  onSaved: (project: Project) => void;
  title?: string;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [folder, setFolder] = useState(initial?.workingFolder || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset fields whenever the modal re-opens (initial may change).
  useEffect(() => {
    if (open) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      setFolder(initial?.workingFolder || "");
      setError("");
    }
  }, [open, initial?.name, initial?.description, initial?.workingFolder]);

  if (!open) return null;

  const isEdit = !!initial?.id;

  async function handleSubmit() {
    if (!name.trim()) { setError("Project name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim(),
        workingFolder: folder.trim(),
      };
      const project: Project = isEdit
        ? await api.updateProject(initial!.id!, payload)
        : await api.createProject(payload);
      onSaved(project);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl border border-border bg-bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border">
          <h3 className="text-base font-semibold text-fg-base">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-fg-subtle hover:text-fg-base hover:bg-fg-base/5"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>
          <div>
            <input
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Folder name (optional, e.g. my-project)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-base text-sm text-fg-base placeholder:text-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
            <p className="mt-1 px-1 text-[11px] text-fg-subtle">
              Path: <code className="text-fg-muted">/app/{folder || "..."}</code>
            </p>
          </div>
          {error && (
            <div className="px-3 py-2 rounded-md text-xs bg-error/10 text-error border border-error/20">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-fg-muted hover:bg-fg-base/5 transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors duration-150",
              saving || !name.trim()
                ? "bg-fg-base/20 cursor-not-allowed"
                : "bg-accent hover:bg-accent/90",
            )}
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project card (grid view) ─────────────────────────────────────────
function ProjectCard({
  project, onClick, onDelete, onTogglePin,
}: {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-xl border border-border bg-bg-surface hover:border-accent/40 hover:shadow-md transition-all duration-150 p-4 flex flex-col gap-2 min-h-[140px]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            <FolderOpen size={14} className="text-accent" />
          </div>
          <h3 className="text-sm font-semibold text-fg-base truncate">{project.name}</h3>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            type="button"
            onClick={onTogglePin}
            className="p-1 rounded text-fg-subtle hover:text-accent hover:bg-fg-base/5"
            title={project.is_pinned ? "Unpin" : "Pin"}
          >
            {project.is_pinned
              ? <Pin size={11} className="text-accent" />
              : <PinOff size={11} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5"
            title="Delete project"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      <p className="text-xs text-fg-muted line-clamp-2 flex-1">
        {project.description || <span className="text-fg-subtle italic">No description</span>}
      </p>
      <div className="text-[10px] text-fg-subtle">
        Updated {formatRelative(project.updatedAt)}
      </div>
    </button>
  );
}

// ── Project row (list view) ──────────────────────────────────────────
function ProjectRow({
  project, onClick, onDelete, onTogglePin,
}: {
  project: Project;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onTogglePin: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-lg border border-border bg-bg-surface hover:border-accent/40 hover:bg-fg-base/[0.02] transition-all duration-150 px-4 py-3 flex items-center gap-3"
    >
      <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
        <FolderOpen size={14} className="text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-fg-base truncate">{project.name}</h3>
        {project.description && (
          <p className="text-xs text-fg-muted truncate">{project.description}</p>
        )}
      </div>
      <div className="text-[11px] text-fg-subtle shrink-0">
        {formatRelative(project.updatedAt)}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
        <button
          type="button"
          onClick={onTogglePin}
          className="p-1 rounded text-fg-subtle hover:text-accent hover:bg-fg-base/5"
          title={project.is_pinned ? "Unpin" : "Pin"}
        >
          {project.is_pinned
            ? <Pin size={11} className="text-accent" />
            : <PinOff size={11} />}
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5"
          title="Delete project"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const navigate = useNavigate();
  const projects     = useProjectsStore((s) => s.projects);
  const loaded       = useProjectsStore((s) => s.loaded);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const togglePin    = useProjectsStore((s) => s.togglePin);

  // View + sort prefs (localStorage)
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === "list" ? "list" : "grid";
    } catch { return "grid"; }
  });
  const [sort, setSort] = useState<SortMode>(() => {
    try {
      const v = localStorage.getItem(SORT_KEY);
      return v === "az" ? "az" : "recent";
    } catch { return "recent"; }
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, view); } catch { /* ignore */ }
  }, [view]);
  useEffect(() => {
    try { localStorage.setItem(SORT_KEY, sort); } catch { /* ignore */ }
  }, [sort]);

  // Search query (in-memory only — not persisted; the agentflow design
  // shows a search next to view toggles).
  const [query, setQuery] = useState("");

  // Create modal
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.slice();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sort === "az") return a.name.localeCompare(b.name);
      // recent → updatedAt desc
      const ad = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bd = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bd - ad;
    });
    return list;
  }, [projects, sort, query]);

  async function handleDelete(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete project "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.deleteProject(String(project.id));
      await loadProjects();
    } catch (err: any) {
      alert(err?.message || "Failed to delete project");
    }
  }

  function handleTogglePin(project: Project, e: React.MouseEvent) {
    e.stopPropagation();
    togglePin(project.id);
  }

  // Empty state — shown when no projects exist (NOT when search returns 0).
  const isEmpty = loaded && projects.length === 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-bg-base">
      <div className="max-w-6xl mx-auto px-6 py-6">
        {isEmpty ? (
          /* ── Empty state ──────────────────────────────────────── */
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-md">
              <h1 className="text-3xl font-bold text-fg-base mb-3">Projects</h1>
              <p className="text-sm text-fg-muted mb-6 leading-relaxed">
                Create a project to organize your work with a dedicated working folder,
                memory notes, and skill selection.
              </p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors duration-150 shadow-sm"
              >
                <Plus size={15} />
                Create your first project
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h1 className="text-2xl font-bold text-fg-base">Projects</h1>
                <p className="text-xs text-fg-muted mt-0.5">
                  {projects.length} {projects.length === 1 ? "project" : "projects"}
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

                {/* View toggle */}
                <div className="flex items-center rounded-md border border-border bg-bg-surface p-0.5">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={clsx(
                      "p-1.5 rounded transition-colors duration-150",
                      view === "grid"
                        ? "bg-accent/10 text-accent"
                        : "text-fg-subtle hover:text-fg-base hover:bg-fg-base/5",
                    )}
                    title="Grid view"
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={clsx(
                      "p-1.5 rounded transition-colors duration-150",
                      view === "list"
                        ? "bg-accent/10 text-accent"
                        : "text-fg-subtle hover:text-fg-base hover:bg-fg-base/5",
                    )}
                    title="List view"
                    aria-label="List view"
                  >
                    <ListIcon size={13} />
                  </button>
                </div>

                {/* + New Project */}
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors duration-150"
                >
                  <Plus size={13} />
                  New Project
                </button>
              </div>
            </div>

            {/* ── Sort pills ─────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[11px] uppercase tracking-wider text-fg-subtle font-medium">Sort:</span>
              <button
                type="button"
                onClick={() => setSort("az")}
                className={clsx(
                  "px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-150",
                  sort === "az"
                    ? "bg-fg-base/85 text-bg-base"
                    : "bg-fg-base/5 text-fg-muted hover:bg-fg-base/10",
                )}
              >
                A–Z
              </button>
              <button
                type="button"
                onClick={() => setSort("recent")}
                className={clsx(
                  "px-3 py-1 rounded-full text-[11px] font-medium transition-colors duration-150",
                  sort === "recent"
                    ? "bg-accent text-white"
                    : "bg-fg-base/5 text-fg-muted hover:bg-fg-base/10",
                )}
              >
                Recent
              </button>
            </div>

            {/* ── Body — grid or list ────────────────────────────── */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-12 text-center">
                <p className="text-sm text-fg-muted">No projects match "{query}"</p>
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onClick={() => navigate(`/project/${p.id}`)}
                    onDelete={(e) => handleDelete(p, e)}
                    onTogglePin={(e) => handleTogglePin(p, e)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    onClick={() => navigate(`/project/${p.id}`)}
                    onDelete={(e) => handleDelete(p, e)}
                    onTogglePin={(e) => handleTogglePin(p, e)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={async (project) => {
          await loadProjects();
          navigate(`/project/${project.id}`);
        }}
      />
    </div>
  );
}
