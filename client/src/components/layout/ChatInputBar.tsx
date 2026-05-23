import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Mic, Send, Square, ChevronDown, ChevronRight, Check, FolderOpen, Lock } from "lucide-react";
import { api } from "../../utils/api";

// ─────────────────────────────────────────────────────────────────────
// ChatInputBar v3 — Phase 2 polish, third iteration.
//
// Layout: two-row card with Plus + textarea + Mic on top, and a
// bottom strip [Ask ▾] [Project ▾] (spacer) [Sub-agent ▾] [Send].
//
// Phase 4: Project chip BROUGHT BACK (after being removed in v3). When a
// project is selected, the parent ChatPage routes messages through the
// `project:chat:send` socket event so the backend applies the project's
// memory + skills + working-folder context. When `projectLocked` is true
// (existing session whose title starts with `[ProjectName]`), the chip
// shows the project name with a lock icon and the dropdown won't open.
//
// Changes since v2:
//   • Textarea max-height is 230px (was 400px). Past 230px, overflow-y
//     scroll inside the textarea itself.
//   • Cascading sub-agent menu's submenus open LEFTWARD because the
//     parent menu is right-anchored (avoids viewport overflow).
//   • Submenu lists cap at 60vh with internal scroll for long lists.
//
// Carries forward from v2:
//   • Cascading 2-level sub-agent menu (None / Auto spawn / Auto AI
//     Create Architecture / Spawn Agent / Realtime / Auto Swarm).
//   • Model dropdown removed — sub-agent occupies its right-side slot.
//   • All dropdown panels use z-[200] above chat-empty.
//   • Web Speech API mic with voice-to-text (append to textarea).
//
// The input bar is positioned ABSOLUTE at the bottom of the chat area
// (see ChatPage.css → .chat-input-container) so when the textarea
// grows up to 230px, the chat-empty background stays fixed and the
// input bar overlays the bottom portion of it.
// ─────────────────────────────────────────────────────────────────────

interface AgentConfig {
  filename: string;
  name?: string;
  agentCount?: number;
}

type SubAgentMode = "auto" | "auto_create" | "manual" | "realtime" | "auto_swarm";

interface SubAgentChoice {
  enabled: boolean;
  mode?: SubAgentMode;
  config?: string;
}

const CHAT_MODE_KEY = "ceteau:chatMode";

// ── Generic cascading menu node ──────────────────────────────────────
type MenuNode =
  | {
      type: "action";
      key: string;
      label: string;
      hint?: string;
      isActive?: boolean;
      onSelect: () => void;
    }
  | {
      type: "group";
      key: string;
      label: string;
      isActive?: boolean;
      children: MenuNode[];
    }
  | { type: "divider"; key: string };

// Recursive menu panel. Each level renders a column; groups open their
// children to the side via absolute positioning. Click outside closes.
function MenuPanel({
  items,
  onClose,
  align = "bottom-left",
  submenuSide = "right",
}: {
  items: MenuNode[];
  onClose: () => void;
  /** Where the FIRST-LEVEL panel anchors against its trigger. */
  align?: "bottom-left" | "bottom-right";
  /** Which side submenus open toward. Use "left" when the parent
   *  menu is right-anchored (otherwise submenus overflow the viewport). */
  submenuSide?: "left" | "right";
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  // Position the top-level panel above the chip (it opens upward).
  // Submenus position relative to their parent row.
  const positionClass =
    align === "bottom-right"
      ? "right-0 bottom-full mb-1"
      : "left-0 bottom-full mb-1";

  // Submenu side classes. We anchor with `bottom-0` (not `top-0`) so
  // the submenu's BOTTOM edge sits at the parent row's bottom — the
  // submenu then grows upward from the arrow level. This matches the
  // main menu's upward expansion direction and keeps long lists from
  // overflowing the bottom of the viewport.
  const submenuPositionClass =
    submenuSide === "left"
      ? "right-full bottom-0 mr-1"
      : "left-full bottom-0 ml-1";

  return (
    <div
      role="menu"
      onClick={(e) => e.stopPropagation()}
      className={`absolute ${positionClass} min-w-[220px] max-w-[320px] py-1 rounded-md border border-border bg-[var(--bg-primary)] shadow-lg z-[200]`}
    >
      {items.map((item) => {
        if (item.type === "divider") {
          return <div key={item.key} className="my-1 border-t border-border" />;
        }
        if (item.type === "action") {
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => { item.onSelect(); onClose(); }}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fg-base/5 ${
                item.isActive ? "text-accent" : "text-fg-base"
              }`}
            >
              {item.isActive ? <Check size={12} className="shrink-0 text-accent" /> : <span className="w-3 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="truncate">{item.label}</div>
                {item.hint && <div className="text-[10px] text-fg-subtle truncate">{item.hint}</div>}
              </div>
            </button>
          );
        }
        // group
        const isOpen = openKey === item.key;
        return (
          <div key={item.key} className="relative">
            <button
              type="button"
              onMouseEnter={() => setOpenKey(item.key)}
              onClick={() => setOpenKey(isOpen ? null : item.key)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fg-base/5 ${
                item.isActive ? "text-accent" : "text-fg-base"
              } ${isOpen ? "bg-fg-base/5" : ""}`}
            >
              {/* P4: chevron on the LEFT (replaces the leading Check/spacer
                  for groups). Active state is conveyed via text color. */}
              <ChevronRight size={12} className="shrink-0 opacity-70" />
              <span className="flex-1 truncate">{item.label}</span>
            </button>
            {isOpen && (
              <div
                className={`absolute ${submenuPositionClass} min-w-[220px] max-w-[320px] max-h-[60vh] overflow-y-auto py-1 rounded-md border border-border bg-[var(--bg-primary)] shadow-lg z-[200]`}
                onClick={(e) => e.stopPropagation()}
              >
                {item.children.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-fg-subtle">(empty)</div>
                ) : item.children.map((child) => {
                  if (child.type === "divider") {
                    return <div key={child.key} className="my-1 border-t border-border" />;
                  }
                  if (child.type === "action") {
                    return (
                      <button
                        key={child.key}
                        type="button"
                        role="menuitem"
                        onClick={() => { child.onSelect(); onClose(); }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-fg-base/5 ${
                          child.isActive ? "text-accent" : "text-fg-base"
                        }`}
                      >
                        {child.isActive ? <Check size={12} className="shrink-0 text-accent" /> : <span className="w-3 shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{child.label}</div>
                          {child.hint && <div className="text-[10px] text-fg-subtle truncate">{child.hint}</div>}
                        </div>
                      </button>
                    );
                  }
                  // Nested groups (3+ levels) not used in current spec;
                  // fall back to action rendering without recursing further.
                  return null;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main input bar ────────────────────────────────────────────────────
/** Minimal project shape the chip needs — id + display name. */
export interface ProjectChoice {
  id: string | number;
  name: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttachClick: () => void;
  canSend: boolean;
  uploading: boolean;
  /** P1: true while the assistant is responding. Swaps Send → Stop. */
  isThinking?: boolean;
  /** P1: called when the user clicks Stop to abort the current task. */
  onStop?: () => void;

  // Phase 4 — Project chip props (all optional, chip hides if `projects`
  // is omitted so callers that don't care don't break).
  /** Full list of selectable projects. Omit to hide the Project chip. */
  projects?: ProjectChoice[];
  /** Currently selected project id (null = no project / global chat). */
  selectedProjectId?: string | number | null;
  /** Called when the user picks a project from the dropdown, or "None". */
  onProjectChange?: (id: string | number | null) => void;
  /** When true, the chip is read-only (used for sessions whose title
   *  prefix already binds them to a project — can't be re-routed). */
  projectLocked?: boolean;
}

export default function ChatInputBar({
  value, onChange, onSend, onAttachClick, canSend, uploading,
  isThinking = false, onStop,
  projects, selectedProjectId = null, onProjectChange, projectLocked = false,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Chat mode (Ask / Act) — localStorage only ──
  const [chatMode, setChatMode] = useState<"ask" | "act">(() => {
    try {
      const v = localStorage.getItem(CHAT_MODE_KEY);
      return v === "act" ? "act" : "ask";
    } catch { return "ask"; }
  });

  // ── Sub-agent state (mirrors settings) ──
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [subAgentEnabled, setSubAgentEnabled] = useState(false);
  const [subAgentMode, setSubAgentMode] = useState<SubAgentMode | "">("");
  const [subAgentConfig, setSubAgentConfig] = useState<string>("");

  // ── Voice input via Web Speech API ──
  const [voiceListening, setVoiceListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const SpeechRecognition: any =
    typeof window !== "undefined" &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const voiceSupported = !!SpeechRecognition;

  // ── Which dropdown is currently open (only one at a time) ──
  const [openMenu, setOpenMenu] = useState<"mode" | "subagent" | "project" | null>(null);

  // ── Load settings + agent configs on mount ──
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const s: any = await api.getSettings();
        if (!mounted) return;
        setSubAgentEnabled(!!s.subAgentEnabled);
        setSubAgentMode((s.subAgentMode as SubAgentMode) || "");
        setSubAgentConfig(s.subAgentConfigFile || "");
      } catch { /* ignore */ }
      try {
        const configs: AgentConfig[] = await api.getAgentConfigs();
        if (mounted) setAgentConfigs(Array.isArray(configs) ? configs : []);
      } catch { /* ignore */ }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // ── Close any open menu on outside click ──
  useEffect(() => {
    if (!openMenu) return;
    const onClick = () => setOpenMenu(null);
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [openMenu]);

  // ── Textarea auto-grow up to 230px, then internal scroll ──
  // The 230px cap keeps the input bar from dominating the screen on
  // long messages. Past 230px, overflow-y: auto on the textarea kicks
  // in and the user scrolls within the textarea itself. The scrollbar
  // is hidden by default and only appears once content exceeds the cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 230) + "px";
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  // ── Voice ──
  function startVoice() {
    if (!SpeechRecognition) return;
    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e: any) => {
        const transcript = e.results?.[0]?.[0]?.transcript || "";
        if (transcript) onChange((value ? value + " " : "") + transcript);
      };
      rec.onend = () => setVoiceListening(false);
      rec.onerror = () => setVoiceListening(false);
      rec.start();
      recognitionRef.current = rec;
      setVoiceListening(true);
    } catch { setVoiceListening(false); }
  }
  function stopVoice() {
    try { recognitionRef.current?.stop?.(); } catch { /* ignore */ }
    setVoiceListening(false);
  }
  const toggleVoice = () => (voiceListening ? stopVoice() : startVoice());

  // ── Chat-mode helpers ──
  async function selectChatMode(m: "ask" | "act") {
    setChatMode(m);
    try { localStorage.setItem(CHAT_MODE_KEY, m); } catch { /* ignore */ }
  }

  // ── Sub-agent helper: applies a choice to local state + backend ──
  async function applySubAgent(choice: SubAgentChoice) {
    setSubAgentEnabled(choice.enabled);
    setSubAgentMode((choice.mode as SubAgentMode) || "");
    setSubAgentConfig(choice.config || "");
    try {
      const s: any = await api.getSettings();
      await api.saveSettings({
        ...s,
        subAgentEnabled: choice.enabled,
        subAgentMode: choice.enabled ? (choice.mode || s.subAgentMode || "auto") : (s.subAgentMode || "auto"),
        subAgentConfigFile: choice.enabled ? (choice.config || "") : (s.subAgentConfigFile || ""),
      });
    } catch { /* ignore */ }
  }

  // ── Sub-agent chip label ──
  const subAgentLabel = useMemo(() => {
    if (!subAgentEnabled) return "None";
    const cfgName =
      agentConfigs.find((c) => c.filename === subAgentConfig)?.name ||
      subAgentConfig ||
      "";
    switch (subAgentMode) {
      case "auto":         return "Auto spawn";
      case "auto_create":  return cfgName ? `Auto Create: ${cfgName}` : "Auto Create";
      case "manual":       return cfgName ? `Spawn: ${cfgName}`       : "Spawn Agent";
      case "realtime":     return cfgName ? `Realtime: ${cfgName}`    : "Realtime Agent";
      case "auto_swarm":   return cfgName ? `Auto Swarm: ${cfgName}`  : "Auto Swarm";
      default:             return "Sub-agent";
    }
  }, [subAgentEnabled, subAgentMode, subAgentConfig, agentConfigs]);

  // ── Build the cascading sub-agent menu tree ──
  const subAgentMenu: MenuNode[] = useMemo(() => {
    const configsAsActions = (mode: SubAgentMode): MenuNode[] =>
      agentConfigs.map((cfg) => ({
        type: "action" as const,
        key: `${mode}-${cfg.filename}`,
        label: cfg.name || cfg.filename,
        hint: cfg.agentCount != null ? `${cfg.agentCount} agents` : undefined,
        isActive: subAgentEnabled && subAgentMode === mode && subAgentConfig === cfg.filename,
        onSelect: () => applySubAgent({ enabled: true, mode, config: cfg.filename }),
      }));

    return [
      {
        type: "action",
        key: "none",
        label: "None",
        hint: "Sub-agent off",
        isActive: !subAgentEnabled,
        onSelect: () => applySubAgent({ enabled: false }),
      },
      {
        type: "action",
        key: "auto",
        label: "Auto spawn",
        isActive: subAgentEnabled && subAgentMode === "auto",
        onSelect: () => applySubAgent({ enabled: true, mode: "auto" }),
      },
      {
        type: "group",
        key: "auto_create",
        label: "Auto AI Create Architecture",
        isActive: subAgentEnabled && subAgentMode === "auto_create",
        children: [
          {
            type: "action",
            key: "auto_create-blank",
            label: "None (AI create from scratch)",
            hint: "No saved configuration",
            isActive: subAgentEnabled && subAgentMode === "auto_create" && !subAgentConfig,
            onSelect: () => applySubAgent({ enabled: true, mode: "auto_create", config: "" }),
          },
          ...(agentConfigs.length > 0
            ? [{ type: "divider" as const, key: "auto_create-divider" }]
            : []),
          ...configsAsActions("auto_create"),
        ],
      },
      {
        type: "group",
        key: "manual",
        label: "Spawn Agent",
        isActive: subAgentEnabled && subAgentMode === "manual",
        children: configsAsActions("manual"),
      },
      {
        type: "group",
        key: "realtime",
        label: "Realtime Agent",
        isActive: subAgentEnabled && subAgentMode === "realtime",
        children: configsAsActions("realtime"),
      },
      {
        type: "group",
        key: "auto_swarm",
        label: "Auto Choose Swarm",
        isActive: subAgentEnabled && subAgentMode === "auto_swarm",
        children: configsAsActions("auto_swarm"),
      },
    ];
  }, [agentConfigs, subAgentEnabled, subAgentMode, subAgentConfig]);

  // ── Project chip ──
  // Selected project's display name (or null if none / not found).
  const selectedProject = useMemo(() => {
    if (selectedProjectId == null || !projects) return null;
    const sel = String(selectedProjectId);
    return projects.find((p) => String(p.id) === sel) || null;
  }, [projects, selectedProjectId]);

  const projectLabel = selectedProject ? selectedProject.name : "Project";

  // Build the project menu: None at top, then one row per project.
  const projectMenu: MenuNode[] = useMemo(() => {
    if (!projects) return [];
    const items: MenuNode[] = [
      {
        type: "action",
        key: "project-none",
        label: "None",
        hint: "Global chat (no project context)",
        isActive: selectedProjectId == null,
        onSelect: () => onProjectChange?.(null),
      },
    ];
    if (projects.length > 0) {
      items.push({ type: "divider", key: "project-divider" });
      for (const p of projects) {
        items.push({
          type: "action",
          key: `project-${p.id}`,
          label: p.name,
          isActive: String(selectedProjectId) === String(p.id),
          onSelect: () => onProjectChange?.(p.id),
        });
      }
    }
    return items;
  }, [projects, selectedProjectId, onProjectChange]);

  // ── Chat-mode menu ──
  const modeMenu: MenuNode[] = [
    {
      type: "action",
      key: "mode-ask",
      label: "Ask",
      hint: "Ask before acting",
      isActive: chatMode === "ask",
      onSelect: () => selectChatMode("ask"),
    },
    {
      type: "action",
      key: "mode-act",
      label: "Act",
      hint: "Act without asking",
      isActive: chatMode === "act",
      onSelect: () => selectChatMode("act"),
    },
  ];

  return (
    <div className="chat-input-card max-w-[820px] w-full mx-auto rounded-2xl border border-border bg-bg-surface shadow-sm relative">

      {/* ── Row 1: + | textarea | mic ── */}
      <div className="flex items-start gap-2 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={onAttachClick}
          disabled={uploading}
          title="Attach files"
          className="shrink-0 mt-1 p-1.5 rounded-md text-fg-muted hover:text-accent hover:bg-fg-base/5 transition-colors duration-150"
        >
          <Plus size={18} className={uploading ? "animate-spin" : ""} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="How can I help you today?"
          className="chat-textarea flex-1 min-w-0 resize-none bg-transparent text-sm text-fg-base placeholder:text-fg-subtle outline-none py-1.5 max-h-[230px] overflow-y-auto"
        />

        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            title={voiceListening ? "Stop listening" : "Voice input"}
            className={`shrink-0 mt-1 p-1.5 rounded-md transition-colors duration-150 ${
              voiceListening
                ? "text-error bg-error/10"
                : "text-fg-muted hover:text-accent hover:bg-fg-base/5"
            }`}
          >
            <Mic size={18} />
          </button>
        )}
      </div>

      {/* ── Row 2: Ask/Act | (spacer) | sub-agent | send ── */}
      {/* P2: bottom strip background matches the chat-input card
          (--bg-primary = #1E293B in dark). Previously bg-bg-base/40
          rendered as a darker overlay; now it's a clean continuation. */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border bg-[var(--bg-primary)] text-[12px]">

        {/* Ask/Act dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "mode" ? null : "mode"); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-fg-muted hover:bg-fg-base/5 hover:text-fg-base transition-colors duration-150"
            title="Chat mode"
          >
            <span className="capitalize">{chatMode}</span>
            <ChevronDown size={12} className="shrink-0 opacity-70" />
          </button>
          {openMenu === "mode" && (
            <MenuPanel items={modeMenu} onClose={() => setOpenMenu(null)} align="bottom-left" />
          )}
        </div>

        {/* Phase 4: Project chip — only renders if the parent passes a
            `projects` array. When locked (existing project-prefixed
            session), shows a Lock icon and the dropdown won't open. */}
        {projects && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (projectLocked) return;
                setOpenMenu(openMenu === "project" ? null : "project");
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-md transition-colors duration-150 max-w-[200px] ${
                selectedProject
                  ? "text-accent hover:bg-accent/10"
                  : "text-fg-muted hover:bg-fg-base/5 hover:text-fg-base"
              } ${projectLocked ? "cursor-default" : ""}`}
              title={
                projectLocked
                  ? `This chat is locked to project "${selectedProject?.name || "?"}"`
                  : selectedProject
                    ? `Project: ${selectedProject.name}`
                    : "Attach this chat to a project"
              }
            >
              {projectLocked
                ? <Lock size={11} className="shrink-0 opacity-80" />
                : <FolderOpen size={11} className="shrink-0 opacity-80" />}
              <span className="truncate">{projectLabel}</span>
              {!projectLocked && <ChevronDown size={12} className="shrink-0 opacity-70" />}
            </button>
            {openMenu === "project" && !projectLocked && (
              <MenuPanel items={projectMenu} onClose={() => setOpenMenu(null)} align="bottom-left" />
            )}
          </div>
        )}

        {/* Spacer pushes sub-agent + send to the right */}
        <div className="flex-1" />

        {/* Sub-agent — cascading 2-level menu in model's old position */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === "subagent" ? null : "subagent"); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-fg-muted hover:bg-fg-base/5 hover:text-fg-base transition-colors duration-150 max-w-[260px]"
            title="Sub-agent mode and configuration"
          >
            <span className="truncate">{subAgentLabel}</span>
            <ChevronDown size={12} className="shrink-0 opacity-70" />
          </button>
          {openMenu === "subagent" && (
            <MenuPanel
              items={subAgentMenu}
              onClose={() => setOpenMenu(null)}
              align="bottom-right"
              submenuSide="right"
            />
          )}
        </div>

        {/* Send / Stop button — toggles based on isThinking (P1) */}
        {isThinking && onStop ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md bg-error text-white hover:bg-error/90 transition-colors duration-150"
          >
            <Square size={12} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            title="Send"
            className={`shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-150 ${
              canSend
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-fg-base/10 text-fg-subtle cursor-not-allowed"
            }`}
          >
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
