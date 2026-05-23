import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Plus, FolderOpen, Zap,
  Pin, MessageSquare, ListTodo, LogOut, Trash2, Folder,
  Sun, Moon, User,
} from "lucide-react";
import {
  DndContext, DragOverlay, useDroppable, useDraggable,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  pointerWithin,
  type DragStartEvent, type DragEndEvent,
  type Modifier,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import { useThemeStore } from "../../store/theme";
import { useConversationsStore } from "../../store/conversations";
import { useProjectsStore } from "../../store/projects";
import { api, clearAccessToken } from "../../utils/api";

// ─────────────────────────────────────────────────────────────────────
// Sidebar — Phase 2 unified global left navigation.
//
// Adapted from the agentflow reference. Differences from the source:
//   • Routes/labels match OUR app (no Flowbot, Files dropped from nav,
//     Task Working points to /tasks, Scheduled points to /schedule).
//   • Stores wired to OUR Fastify endpoints via utils/api.
//   • Auth uses our access-token system (clearAccessToken + reload)
//     instead of agentflow's JWT auth store.
//   • The drag modifier no longer divides by --global-zoom (we don't
//     use body-zoom). It's now a pure vertical-axis lock.
//   • Agent-mode tags from the old header land here under the brand,
//     conditionally rendered only when subAgentEnabled is true.
// ─────────────────────────────────────────────────────────────────────

const TOP_NAV = [
  { path: "/project",  label: "Projects",  icon: FolderOpen    },
  { path: "/skills",   label: "Skill",     icon: Zap           },
] as const;

// Phase 4 recheck: Settings is hidden from the sidebar. Route stays
// registered in App.tsx so it's still accessible by typing /settings
// in the URL bar (same convention as /files).
const BOTTOM_NAV = [
  { path: "/tasks",    label: "Task / Schedule", icon: ListTodo },
] as const;

// Drop-zone ids — single source of truth so the dnd handlers and the JSX
// can't drift apart.
const PIN_ZONE_ID    = "sidebar-pinned-zone";
const PIN_EMPTY_ID   = "sidebar-pinned-empty";
const RECENT_ZONE_ID = "sidebar-recent-zone";

// Pure axis-lock modifier. The agentflow original also divided y by
// --global-zoom to compensate for body's `zoom: 0.75`. We don't use
// global-zoom, so the compensation is gone — just keep horizontal drift
// pinned at 0 so the chat row only moves up/down inside the sidebar.
const verticalAxisLock: Modifier = ({ transform }) => ({ ...transform, x: 0 });

// ── Shared row component ──────────────────────────────────────────────
function NavRow({
  active, icon: Icon, label, onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-200",
        active
          ? "bg-accent/10 text-accent"
          : "text-fg-muted hover:bg-fg-base/5 hover:text-fg-base",
      )}
    >
      <Icon size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
      {children}
    </p>
  );
}

// ── Pinned project row ────────────────────────────────────────────────
function PinnedProjectRow({
  id, name, onSelect,
}: {
  id: number | string;
  name: string;
  onSelect: () => void;
}) {
  const location = useLocation();
  const active = location.pathname === `/project/${id}`;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-200 select-none",
        active
          ? "bg-accent/[0.08] text-accent"
          : "text-fg-muted hover:bg-fg-base/5 hover:text-fg-base",
      )}
    >
      <Folder size={12} className="shrink-0 opacity-80" />
      <span className="truncate flex-1 text-left">{name}</span>
    </button>
  );
}

// ── Draggable chat row ────────────────────────────────────────────────
function ChatRow({
  id, title, active, isPinned, onSelect, onDelete,
}: {
  id: number | string;
  title: string;
  active: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `chat:${id}`,
    data: { type: "chat", id },
  });

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Translate.toString(transform),
    visibility: isDragging ? "hidden" : "visible",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={clsx(
        "group w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-200 select-none cursor-pointer",
        active
          ? "bg-accent/[0.08] text-accent"
          : "text-fg-muted hover:bg-fg-base/5 hover:text-fg-base",
      )}
      {...attributes}
      {...listeners}
    >
      {isPinned
        ? <Pin            size={12} className="shrink-0 opacity-80" />
        : <MessageSquare  size={13} className="shrink-0 opacity-60" />}
      <span className="truncate flex-1 text-left">{title}</span>
      <button
        type="button"
        onClick={onDelete}
        onPointerDown={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 text-fg-subtle hover:text-error transition-colors duration-200 p-0.5 shrink-0"
        title="Delete conversation"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

// ── Drop zone wrapper ─────────────────────────────────────────────────
function DropZone({
  id, children, empty, emptyLabel,
}: {
  id: string;
  children?: React.ReactNode;
  empty?: boolean;
  emptyLabel?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      data-zone={id}
      className={clsx(
        "mx-1 my-1 rounded-lg transition-all duration-200",
        empty
          ? clsx(
              "border border-dashed py-3 px-3 flex items-center justify-center gap-2",
              isOver
                ? "border-accent/50 bg-accent/[0.08] text-accent"
                : "border-fg-base/[0.08] text-fg-subtle hover:border-fg-base/[0.14]",
            )
          : clsx("py-1", isOver && "ring-1 ring-accent/30 bg-accent/[0.05]"),
      )}
    >
      {empty ? (
        <>
          <Pin size={11} className={clsx("shrink-0", isOver ? "text-accent" : "opacity-60")} />
          <span className="text-[11px] font-medium">{emptyLabel ?? "Drag to pin"}</span>
        </>
      ) : children}
    </div>
  );
}

// ── Theme toggle button (Sun/Moon) ────────────────────────────────────
function ThemeToggleButton() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
      className="p-1 rounded text-fg-subtle hover:text-accent hover:bg-fg-base/5 transition-colors duration-200 shrink-0"
    >
      {isDark ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );
}

// ── Main Sidebar export ───────────────────────────────────────────────
export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Conversations store
  const conversations     = useConversationsStore((s) => s.conversations);
  const pinnedIds         = useConversationsStore((s) => s.pinnedIds);
  const loadConversations = useConversationsStore((s) => s.loadConversations);
  const deleteConv        = useConversationsStore((s) => s.deleteConversation);
  const setPin            = useConversationsStore((s) => s.setPin);

  // Projects store
  const projects     = useProjectsStore((s) => s.projects);
  const loadProjects = useProjectsStore((s) => s.loadProjects);

  // Local drag state
  const [activeDragId, setActiveDragId] = useState<string | number | null>(null);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadProjects(); }, [loadProjects]);

  const pinnedProjects = useMemo(
    () => projects.filter((p) => p.is_pinned),
    [projects],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const pinnedSet = useMemo(() => new Set(pinnedIds.map(String)), [pinnedIds]);
  const { pinned, recent } = useMemo(() => {
    const p: typeof conversations = [];
    const r: typeof conversations = [];
    for (const c of conversations) (pinnedSet.has(String(c.id)) ? p : r).push(c);
    return { pinned: p, recent: r };
  }, [conversations, pinnedSet]);

  const draggedConv = activeDragId != null
    ? conversations.find((c) => String(c.id) === String(activeDragId)) ?? null
    : null;

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith("chat:")) setActiveDragId(id.slice(5));
  }, []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveDragId(null);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    const activeStrId = String(e.active.id);
    if (!activeStrId.startsWith("chat:")) return;
    const chatId = activeStrId.slice(5);

    if (overId === PIN_ZONE_ID || overId === PIN_EMPTY_ID) setPin(chatId, true);
    else if (overId === RECENT_ZONE_ID)                    setPin(chatId, false);
  }, [setPin]);

  const activeChatId = useMemo(() => {
    const m = location.pathname.match(/^\/chat\/([^/]+)/) || location.pathname.match(/^\/$/);
    if (!m) return null;
    return m[1] ?? null;
  }, [location.pathname]);

  const isPathActive = (path: string) => {
    if (path === "/project")  return location.pathname.startsWith("/project");
    if (path === "/skills")   return location.pathname.startsWith("/skills");
    if (path === "/tasks")    return location.pathname.startsWith("/tasks");
    if (path === "/settings") return location.pathname.startsWith("/settings");
    return false;
  };

  function handleSignOut() {
    try { clearAccessToken(); } catch { /* ignore */ }
    window.location.reload();
  }

  // "+ New chat" — P3: defer session creation until the user actually
  // sends their first message. Otherwise the sidebar gets a "New chat"
  // row with no message in it and the title never updates from the
  // user's prompt. Now we just clear the URL; handleSend in ChatPage
  // creates the session with the prompt's first ~50 chars as the title.
  function handleNewChat() {
    navigate("/");
  }

  return (
    <DndContext
      sensors={sensors}
      modifiers={[verticalAxisLock]}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      <aside className="w-72 shrink-0 h-full flex flex-col bg-bg-surface border-r border-border text-fg-muted">

        {/* ─── TOP: brand + agent-mode chip + new chat + primary nav ─── */}
        <div className="p-3 shrink-0">

          {/* Brand — P6: not a button, no nav action, no hover state.
              Static brand display only. */}
          <div className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 select-none">
            <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center shrink-0">
              <span className="text-[14px] font-bold text-white">C</span>
            </div>
            <span className="text-sm font-semibold text-fg-base tracking-tight">
              CeTeau<span className="text-accent">|AI</span>
            </span>
          </div>

          {/* Agent-mode chip lives in ChatPage's input area, not here.
              See ChatPage.tsx for the conditional render. */}

          {/* + New chat — creates a session via API and navigates to it */}
          <button
            type="button"
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-sm font-medium transition-colors duration-200"
          >
            <Plus size={15} className="shrink-0" />
            <span>New chat</span>
          </button>

          {/* Primary nav */}
          <nav className="mt-2 space-y-0.5">
            {TOP_NAV.map(({ path, label, icon }) => (
              <NavRow
                key={path}
                active={isPathActive(path)}
                icon={icon}
                label={label}
                onClick={() => navigate(path)}
              />
            ))}
          </nav>
        </div>

        {/* ─── MIDDLE: Pinned + Recents (flex-1, scrolls) ─── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 py-3 space-y-4 border-t border-border">

          <section>
            <SectionHeader>Pinned</SectionHeader>

            {pinnedProjects.length > 0 && (
              <div className="mx-1 flex flex-col gap-0.5 mb-1">
                {pinnedProjects.map((proj) => (
                  <PinnedProjectRow
                    key={proj.id}
                    id={proj.id}
                    name={proj.name}
                    onSelect={() => navigate(`/project/${proj.id}`)}
                  />
                ))}
              </div>
            )}

            {pinned.length === 0 ? (
              pinnedProjects.length === 0 && (
                <DropZone id={PIN_EMPTY_ID} empty emptyLabel="Drag to pin" />
              )
            ) : (
              <DropZone id={PIN_ZONE_ID}>
                <div className="flex flex-col gap-0.5">
                  {pinned.map((c) => (
                    <ChatRow
                      key={c.id}
                      id={c.id}
                      title={c.title}
                      active={String(activeChatId) === String(c.id)}
                      isPinned
                      onSelect={() => navigate(`/chat/${c.id}`)}
                      onDelete={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                    />
                  ))}
                </div>
              </DropZone>
            )}
          </section>

          <section>
            <SectionHeader>Recents</SectionHeader>
            <DropZone id={RECENT_ZONE_ID}>
              {recent.length === 0 ? (
                <p className="text-[11px] text-fg-subtle px-3 py-3 text-center">No conversations yet</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {recent.map((c) => (
                    <ChatRow
                      key={c.id}
                      id={c.id}
                      title={c.title}
                      active={String(activeChatId) === String(c.id)}
                      isPinned={false}
                      onSelect={() => navigate(`/chat/${c.id}`)}
                      onDelete={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                    />
                  ))}
                </div>
              )}
            </DropZone>
          </section>
        </div>

        {/* ─── BOTTOM: utility nav + minimal user pill ─── */}
        <div className="mt-auto px-2 py-3 border-t border-border space-y-0.5 shrink-0">
          {BOTTOM_NAV.map(({ path, label, icon }) => (
            <NavRow
              key={path}
              active={isPathActive(path)}
              icon={icon}
              label={label}
              onClick={() => navigate(path)}
            />
          ))}

          {/* Minimal user pill: avatar + theme toggle + logout (Option B). */}
          <div className="mt-2 flex items-center gap-2 px-2 py-2 rounded-lg bg-fg-base/[0.03] border border-fg-base/[0.05]">
            <div className="w-7 h-7 rounded-md bg-accent/20 flex items-center justify-center shrink-0">
              <User size={13} className="text-accent" />
            </div>
            <div className="flex-1" />
            <ThemeToggleButton />
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-1 rounded text-fg-subtle hover:text-error hover:bg-fg-base/5 transition-colors duration-200 shrink-0"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      <DragOverlay dropAnimation={null}>
        {draggedConv && (
          <div className="w-64 px-3 py-2 rounded-lg bg-bg-surface border border-accent/40 shadow-lg flex items-center gap-2 cursor-grabbing scale-[1.02]">
            <MessageSquare size={13} className="opacity-60 text-fg-muted" />
            <span className="truncate text-sm text-fg-base">{draggedConv.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
