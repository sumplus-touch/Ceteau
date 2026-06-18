import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { useConversationsStore } from "../store/conversations";
import { useProjectsStore } from "../store/projects";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { api, sandboxUrl } from "../utils/api";
import { useSocket } from "../hooks/useSocket";
import { Icon } from "../components/Icon";
import ChatInputBar from "../components/layout/ChatInputBar";
import { UserMessageBubble, CopyButton } from "../components/MessageBubble";
import { ChevronDown } from "lucide-react";
import ReactComponentRenderer from "../components/ReactComponentRenderer";
import "./ChatPage.css";

const AgentEditor = lazy(() => import("../components/AgentEditor"));

interface AttachedFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface MessageFeedback {
  rating?: "up" | "down";
  comment?: string;
  submittedAt?: string;
}

interface Message {
  role: string;
  content: string;
  timestamp: string;
  files?: string[];
  attachments?: AttachedFile[];
  feedback?: MessageFeedback;
}

interface Session {
  id: string;
  title: string;
  messageCount?: number;
  createdAt: string;
  updatedAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["pdf"].includes(ext)) return "PDF";
  if (["doc", "docx"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "IMG";
  if (["py", "js", "ts", "html", "css", "json", "md", "yaml", "yml", "xml"].includes(ext)) return "TXT";
  if (["zip", "tar", "gz"].includes(ext)) return "ZIP";
  return "FILE";
}

function getFileExt(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function DocPreview({ file }: { file: string }) {
  const [html, setHtml] = useState<string>("");
  const [info, setInfo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.previewFile(file).then((data: any) => {
      if (data.error) {
        setError(data.error);
      } else {
        setHtml(data.html || "");
        if (data.pages) setInfo(`${data.pages} page${data.pages > 1 ? "s" : ""}`);
      }
      setLoading(false);
    }).catch((err: any) => {
      setError(err.message || "Failed to load preview");
      setLoading(false);
    });
  }, [file]);

  if (loading) return <div className="doc-preview-loading">Loading preview...</div>;
  if (error) return <div className="doc-preview-error">Preview unavailable: {error}</div>;

  return (
    <div className="doc-preview-content">
      {info && <div className="doc-preview-info">{info}</div>}
      <div className="doc-preview-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function MarkdownPreview({ file }: { file: string }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.previewFile(file).then((data: any) => {
      if (data.error) {
        setError(data.error);
      } else {
        setContent(data.html || "");
      }
      setLoading(false);
    }).catch((err: any) => {
      setError(err.message || "Failed to load preview");
      setLoading(false);
    });
  }, [file]);

  if (loading) return <div className="doc-preview-loading">Loading preview...</div>;
  if (error) return <div className="doc-preview-error">Preview unavailable: {error}</div>;

  return (
    <div className="doc-preview-content markdown-preview">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>
    </div>
  );
}

function OutputCanvas({ files }: { files: string[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const images = files.filter((f) => ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(getFileExt(f)));
  const reactFiles = files.filter((f) => f.endsWith(".jsx.js"));
  const htmlFiles = files.filter((f) => getFileExt(f) === "html" && !f.endsWith(".jsx.js"));
  const pdfFiles = files.filter((f) => getFileExt(f) === "pdf");
  const docFiles = files.filter((f) => ["doc", "docx"].includes(getFileExt(f)));
  const excelFiles = files.filter((f) => ["xls", "xlsx"].includes(getFileExt(f)));
  const mdFiles = files.filter((f) => getFileExt(f) === "md");
  const otherFiles = files.filter((f) => !images.includes(f) && !reactFiles.includes(f) && !htmlFiles.includes(f) && !pdfFiles.includes(f) && !docFiles.includes(f) && !excelFiles.includes(f) && !mdFiles.includes(f));

  return (
    <div className="output-canvas">
      {/* Inline images (charts, plots) */}
      {images.length > 0 && (
        <div className="canvas-images">
          {images.map((f) => (
            <div key={f} className="canvas-image-wrap">
              <img
                src={sandboxUrl(f, true)}
                alt={f}
                className={`canvas-image ${expanded === f ? "expanded" : ""}`}
                onClick={() => setExpanded(expanded === f ? null : f)}
              />
              <div className="canvas-image-toolbar">
                <span className="canvas-image-name">{f.split("/").pop()}</span>
                <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Native React components (compiled JSX) */}
      {reactFiles.map((f) => (
        <div key={f} className="canvas-react-wrap">
          <div className="canvas-html-header">
            <span>{f.split("/").pop()?.replace(".jsx.js", "")}</span>
            <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download source">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </a>
          </div>
          <div className="canvas-react-body">
            <ReactComponentRenderer src={sandboxUrl(f, true)} />
          </div>
        </div>
      ))}

      {/* HTML reports in iframe */}
      {htmlFiles.map((f) => (
        <div key={f} className="canvas-html-wrap">
          <div className="canvas-html-header">
            <span>{f.split("/").pop()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <a href={sandboxUrl(f)} target="_blank" rel="noreferrer" className="canvas-dl-btn" title="Open in new tab">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
              </a>
              <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </a>
            </div>
          </div>
          <iframe src={sandboxUrl(f, true)} className="canvas-html-iframe" title={f} />
        </div>
      ))}

      {/* PDF preview with native iframe viewer */}
      {pdfFiles.map((f) => (
        <div key={f} className="canvas-html-wrap">
          <div className="canvas-html-header">
            <div className="canvas-doc-icon pdf" style={{ marginRight: 6 }}>PDF</div>
            <span>{f.split("/").pop()}</span>
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              <a href={sandboxUrl(f)} target="_blank" rel="noreferrer" className="canvas-dl-btn" title="Open in new tab">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
              </a>
              <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </a>
            </div>
          </div>
          <iframe src={sandboxUrl(f)} className="canvas-html-iframe" style={{ height: 700 }} title={f.split("/").pop() || "PDF"} />
        </div>
      ))}

      {/* Word document preview */}
      {docFiles.map((f) => (
        <div key={f} className="canvas-doc-wrap">
          <div className="canvas-doc-header">
            <div className="canvas-doc-icon doc">DOC</div>
            <span>{f.split("/").pop()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </a>
            </div>
          </div>
          <DocPreview file={f} />
        </div>
      ))}

      {/* Excel file preview */}
      {excelFiles.map((f) => (
        <div key={f} className="canvas-doc-wrap">
          <div className="canvas-doc-header">
            <div className="canvas-doc-icon excel">XLS</div>
            <span>{f.split("/").pop()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </a>
            </div>
          </div>
          <DocPreview file={f} />
        </div>
      ))}

      {/* Markdown file preview */}
      {mdFiles.map((f) => (
        <div key={f} className="canvas-doc-wrap">
          <div className="canvas-doc-header">
            <div className="canvas-doc-icon md">MD</div>
            <span>{f.split("/").pop()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <a href={api.downloadUrl(f)} download className="canvas-dl-btn" title="Download">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </a>
            </div>
          </div>
          <MarkdownPreview file={f} />
        </div>
      ))}

      {/* Other files as download chips */}
      {otherFiles.length > 0 && (
        <div className="canvas-other-files">
          {otherFiles.map((f) => (
            <a key={f} href={api.downloadUrl(f)} className="file-chip" download>
              <span className="file-chip-icon">{getFileIcon(f)}</span>
              {f.split("/").pop()}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Phase-2 polish: the new global Sidebar navigates to `/chat/:id`
  // when a chat row is clicked, so read the route param and use it
  // to drive activeSession. Without this, clicking a chat in
  // Pinned/Recents updates the URL but never loads the messages.
  const routeParams = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [runningTaskIds, setRunningTaskIds] = useState<Set<string>>(new Set());
  const isLoading = runningTaskIds.size > 0;
  const [status, setStatus] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [outputPanelOpen, setOutputPanelOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [activeTaskSessions, setActiveTaskSessions] = useState<Set<string>>(new Set());
  const [outputRefreshKey, setOutputRefreshKey] = useState(0);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogContent, setActivityLogContent] = useState("");
  const activityLogRef = useRef<HTMLDivElement>(null);
  const [showChatLog, setShowChatLog] = useState(false);
  const [chatLogContent, setChatLogContent] = useState("");
  const chatLogRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // P-E: track scroll position for the scroll-to-bottom floating button.
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ── UX: restore an unsent message to the input box ──────────────────
  // When a send is stopped/cancelled or ends without a real reply, put the
  // user's text + attachments back so they aren't lost. Captured at send
  // time; cleared in onResponse on a genuine reply; restored by the
  // thinking→idle effect below. NOTE: the backend posts a
  // "Task was cancelled." assistant reply on Stop, so that content is
  // treated as NOT successful (we keep the pending text and restore it).
  const pendingSendRef = useRef<{ text: string; files: AttachedFile[]; sentContent: string } | null>(null);
  const wasThinkingRef = useRef(false);
  const [autoCreatedArch, setAutoCreatedArch] = useState<{ filename: string; systemName: string } | null>(null);
  const [showAgentEditor, setShowAgentEditor] = useState(false);
  const [agentEditorYaml, setAgentEditorYaml] = useState<string | undefined>();
  const [agentEditorFilename, setAgentEditorFilename] = useState<string | undefined>();
  const [humanFeedbackEnabled, setHumanFeedbackEnabled] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState<number | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState<number | null>(null);
  const { connected, sendMessage, sendProjectMessage, onChunk, onResponse, onStatus, socket: socketRef } = useSocket();

  // ─── Phase 4: project context ─────────────────────────────────────
  // selectedProjectId drives which socket event sends the message:
  //   null  → sendMessage              (global chat)
  //   set   → sendProjectMessage(...)  (backend loads memory/skills/folder)
  // The chip is "locked" (read-only) when an existing session's title
  // already binds it to a project — the prefix encodes the relationship
  // on the backend and switching projects mid-session would lie.
  const projectsList = useProjectsStore((s) => s.projects);
  const loadProjects = useProjectsStore((s) => s.loadProjects);
  const projectsLoaded = useProjectsStore((s) => s.loaded);
  const [selectedProjectId, setSelectedProjectId] = useState<string | number | null>(null);
  const [projectLocked, setProjectLocked] = useState(false);

  // Make sure the projects store is populated so the chip dropdown
  // actually has rows to render.
  useEffect(() => {
    if (!projectsLoaded) loadProjects();
  }, [projectsLoaded, loadProjects]);

  // P1: any time the user lands on `/` (no chat id in URL), reset the
  // project chip — unless a `?project=` param is present, in which case
  // we apply it (this is the /project/:id "+ New Chat" entry point).
  // This makes the sidebar "+ New chat" button feel like a clean fresh
  // start: even if you were just in a project chat, the chip clears.
  useEffect(() => {
    if (routeParams.id) return; // only fires on `/` (compose mode)
    const projectParam = searchParams.get("project");
    if (projectParam) {
      setSelectedProjectId(projectParam);
      setProjectLocked(false);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("project");
        return next;
      }, { replace: true });
    } else {
      setSelectedProjectId(null);
      setProjectLocked(false);
    }
  }, [routeParams.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the lightweight {id,name}[] the ChatInputBar wants.
  const chipProjects = useMemo(
    () => (projectsList || []).map((p) => ({ id: p.id, name: p.name })),
    [projectsList],
  );

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then((s: any) => {
      if (!cancelled) setHumanFeedbackEnabled(!!s?.skillAutoUpdateHumanFeedbackEnabled);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submitFeedback = async (
    index: number,
    payload: { rating?: "up" | "down"; comment?: string; clear?: boolean },
  ) => {
    if (!activeSession) return;
    setFeedbackBusy(index);
    try {
      const res = await api.saveMessageFeedback(activeSession, index, payload);
      if (res?.ok) {
        setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, feedback: res.feedback || undefined } : m)));
      }
    } catch {}
    setFeedbackBusy(null);
  };

  // Collect all output files from messages for the right panel
  const allOutputFiles = messages.reduce<{ files: string[]; msgIndex: number }[]>((acc, msg, i) => {
    if (msg.files && msg.files.length > 0) {
      acc.push({ files: msg.files, msgIndex: i });
    }
    return acc;
  }, []);

  useEffect(() => {
    api.getSessions().then((s: Session[]) => {
      setSessions(s);
      // Auto-select session from URL ?session=<id>
      const sessionParam = searchParams.get("session");
      if (sessionParam && s.some((sess: Session) => sess.id === sessionParam)) {
        setActiveSession(sessionParam);
        setSearchParams({}, { replace: true }); // clean URL
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 3: Project detail page's chat tab navigates here with
  // ?prompt=<text> so the typed prompt isn't lost. Seed the input
  // (no auto-send — user confirms by pressing Enter / Send).
  useEffect(() => {
    const promptParam = searchParams.get("prompt");
    if (promptParam) {
      setInput(decodeURIComponent(promptParam));
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("prompt");
        return next;
      }, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // P4: sync activeSession from the /chat/:id route param. When the
  // sidebar navigates to a chat URL, this picks it up and triggers
  // the message-load effect below.
  useEffect(() => {
    const idFromUrl = routeParams.id;
    if (idFromUrl && idFromUrl !== activeSession) {
      setActiveSession(idFromUrl);
    } else if (!idFromUrl && activeSession) {
      // Navigated to "/" (no :id) — clear the active session so the
      // empty-state dashboard shows.
      setActiveSession(null);
      setMessages([]);
    }
  }, [routeParams.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 4 recheck — bug (b) fix: "click chat in recent shows new chat".
  // Symptoms came from three things in the old version:
  //   1) No `.catch` on getSession — silent failures left messages empty,
  //      so the empty-state branch rendered as if it were a brand-new chat.
  //   2) Old messages stayed on screen while the new session was fetching,
  //      then snapped to the new content (visual flicker / wrong content).
  //   3) Stale responses from a previous session could overwrite the
  //      current session's messages if you switched chats quickly.
  // Fix: clear messages immediately, guard against stale responses with a
  // request token, catch and surface errors, and track a loading flag so
  // we render "Loading chat…" instead of the empty-state-as-new-chat.
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionLoadTokenRef = useRef(0);

  // Tracks the session id that was *just created* in handleSend so the
  // effect below knows not to clear locally-staged messages for it (we
  // already have the user's first message rendered; let the backend
  // catch up). Without this, the "just sent" message would flash to
  // empty before the backend round-trip completes.
  const freshlyCreatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeSession) {
      setSessionLoading(false);
      setSessionError(null);
      return;
    }
    const isFresh = freshlyCreatedRef.current === activeSession;
    if (isFresh) freshlyCreatedRef.current = null;

    const myToken = ++sessionLoadTokenRef.current;
    setSessionLoading(true);
    setSessionError(null);
    // Only clear messages when SWITCHING to a different existing session
    // (otherwise we'd wipe the optimistic message handleSend just staged).
    if (!isFresh) setMessages([]);

    api.getSession(activeSession)
      .then((session: any) => {
        if (myToken !== sessionLoadTokenRef.current) return; // stale, drop
        const fetched = session.messages || [];
        // Don't shrink: if the optimistic local state has more messages
        // than the backend currently reports (backend hasn't persisted
        // yet), keep the local state. Otherwise apply the fetched one.
        setMessages((prev) => fetched.length < prev.length ? prev : fetched);
        if (session.autoCreatedArch) {
          setAutoCreatedArch(session.autoCreatedArch);
        } else {
          setAutoCreatedArch(null);
        }
      })
      .catch((err) => {
        if (myToken !== sessionLoadTokenRef.current) return;
        console.error("[ChatPage] getSession failed:", err);
        setSessionError(err?.message || "Failed to load chat");
      })
      .finally(() => {
        if (myToken === sessionLoadTokenRef.current) setSessionLoading(false);
      });
  }, [activeSession]);

  // Phase 4: derive the project chip from the active session's title
  // prefix. Once a session exists, its title is what the backend filters
  // on — switching the chip can't change that — so the chip is LOCKED
  // for any existing session:
  //   • title starts with `[X]`  → chip locked to project X
  //   • no prefix                → chip locked to "None" (global)
  //   • no activeSession         → chip is free (user's pick stands)
  useEffect(() => {
    if (!activeSession) {
      // Compose box on `/`. Keep whatever the user picked (or what came
      // from ?project=<id>) and leave the chip editable.
      setProjectLocked(false);
      return;
    }
    const sess = sessions.find((s) => s.id === activeSession);
    if (!sess?.title) return;
    const m = /^\[([^\]]+)\]/.exec(sess.title);
    if (!m) {
      // Existing global session — lock chip to None.
      setSelectedProjectId(null);
      setProjectLocked(true);
      return;
    }
    const projectName = m[1];
    const match = (projectsList || []).find((p) => p.name === projectName);
    if (match) {
      setSelectedProjectId(match.id);
      setProjectLocked(true);
    } else {
      // Title looks project-prefixed but project not found (deleted?).
      // Lock to None so we don't accidentally send to the wrong project.
      setSelectedProjectId(null);
      setProjectLocked(true);
    }
  }, [activeSession, sessions, projectsList]);

  const toolLabels: Record<string, string> = {
    web_search: "Searching the web",
    fetch_url: "Fetching URL",
    run_python: "Running Python",
    run_react: "Running React",
    run_shell: "Running command",
    read_file: "Reading file",
    write_file: "Writing file",
    list_files: "Listing files",
    list_skills: "Listing skills",
    load_skill: "Loading skill",
    clawhub_search: "Searching ClawHub",
    clawhub_install: "Installing skill",
    spawn_subagent: "Spawning sub-agent",
    send_task: "Delegating task",
    wait_result: "Waiting for agent",
    check_agents: "Checking agents",
    error_recovery: "Recovering from error",
  };

  // Restore in-progress state on mount, reconnect, or session switch
  // Track whether we previously saw an active task so we can detect completion
  const wasLoadingRef = useRef(false);
  const missCountRef = useRef(0); // require multiple consecutive misses before treating as done
  useEffect(() => {
    if (!activeSession) return;
    let cancelled = false;

    const checkActiveTasks = () => {
      api.getActiveTasks().then((tasks: any[]) => {
        if (cancelled) return;
        // Track all sessions with active tasks for sidebar indicators
        // Use API as additive source — only "done" status events should remove sessions.
        // This prevents a race where the HTTP poll response arrives after a WebSocket
        // status event, overwriting sessions that were just added by real-time events.
        const apiSessions = new Set(tasks.map((t: any) => t.sessionId).filter(Boolean));
        setActiveTaskSessions((prev) => {
          const merged = new Set(prev);
          for (const s of apiSessions) merged.add(s);
          // If identical, skip re-render
          if (merged.size === prev.size) return prev;
          return merged;
        });
        // Track running tasks by ID for this session
        const sessionTasks = tasks.filter((t: any) => t.sessionId === activeSession);
        const sessionTaskIds = new Set(sessionTasks.map((t: any) => t.id as string));
        setRunningTaskIds(sessionTaskIds);
        const activeTask = sessionTasks[sessionTasks.length - 1]; // show status of most recent task
        if (activeTask) {
          wasLoadingRef.current = true;
          missCountRef.current = 0;
          if (activeTask.status.startsWith("Running:")) {
            const rawTool = activeTask.status.replace("Running: ", "");
            const tool = rawTool.split(" — ")[0]; // extract tool name before description
            const detail = rawTool.includes(" — ") ? rawTool.split(" — ")[1] : "";
            if (tool === "wait_result" && detail) {
              setStatus(`Waiting for ${detail}...`);
            } else if (tool === "send_task" && detail) {
              setStatus(`${detail}...`);
            } else {
              const label = toolLabels[tool] || tool;
              setStatus(`${label}...`);
            }
          } else if (activeTask.status.startsWith("Waiting for ") || activeTask.status.includes("done, thinking") || activeTask.status.includes("orchestrating") || activeTask.status.includes("received")) {
            setStatus(activeTask.status);
          } else {
            setStatus("Thinking...");
          }
        } else if (wasLoadingRef.current) {
          // Task was active before but is now gone — require 2 consecutive misses
          // to avoid clearing state on transient network blips
          missCountRef.current++;
          if (missCountRef.current >= 2) {
            // Task is truly done — the chat:response event was likely missed
            // Reset loading state and refresh messages to show the result
            wasLoadingRef.current = false;
            missCountRef.current = 0;
            setRunningTaskIds(new Set());
            setStreaming("");
            setStatus("");
            api.getSession(activeSession).then((session: any) => {
              if (cancelled) return;
              const fetched: Message[] = session.messages || [];
              // P3: don't let polling-driven refetch shrink the list.
              // In sub-agent mode the backend can transiently report
              // "no active task" before it has persisted the user's
              // last message. If we blindly replaced state here, the
              // user's prompt would disappear until the backend caught
              // up. Only apply the refetch if it grows or matches.
              setMessages((prev) => fetched.length < prev.length ? prev : fetched);
            });
          }
        }
      }).catch(() => {});
    };

    checkActiveTasks();

    // Poll every 3 seconds to keep status fresh and detect missed completions
    const interval = setInterval(() => {
      if (!cancelled) checkActiveTasks();
    }, 3000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [activeSession, connected]);

  // Buffer incoming chunks and flush to state at most every 100ms to avoid flooding React
  const chunkBufferRef = useRef("");
  const chunkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const flushChunks = () => {
      chunkFlushTimerRef.current = null;
      if (chunkBufferRef.current) {
        const buf = chunkBufferRef.current;
        chunkBufferRef.current = "";
        setStreaming((prev) => prev + buf);
      }
    };

    const unsub1 = onChunk((data: any) => {
      if (data.sessionId === activeSession) {
        if (data.clear) {
          chunkBufferRef.current = "";
          if (chunkFlushTimerRef.current) {
            clearTimeout(chunkFlushTimerRef.current);
            chunkFlushTimerRef.current = null;
          }
          setStreaming("");
        } else {
          chunkBufferRef.current += data.content;
          if (!chunkFlushTimerRef.current) {
            chunkFlushTimerRef.current = setTimeout(flushChunks, 100);
          }
        }
      }
    });
    const unsub2 = onResponse((data) => {
      // Don't clear activeTaskSessions here — let the "done" status handle it
      // to avoid premature green dot removal while the task is still cleaning up
      if (data.sessionId === activeSession) {
        // The backend emits a "Task was cancelled." chat:response on Stop.
        // That is NOT a successful turn: keep the pending text (the
        // thinking→idle effect restores it to the input box) and "un-send"
        // the user's message below. A genuine reply clears the pending ref.
        const cancelled = !!data.content?.startsWith("Task was cancelled.");
        if (!cancelled) pendingSendRef.current = null;
        const unsent = cancelled ? pendingSendRef.current : null;

        // Refresh messages from server to get the complete history including the new response
        wasLoadingRef.current = false;
        api.getSession(activeSession).then(async (session: any) => {
          let msgs = (session.messages || []) as Message[];
          // True un-send: on a cancelled turn, remove the user message we
          // just sent from the transcript AND the backend, keeping the
          // "Task was cancelled." notice. Matched by content so we delete
          // exactly the prompt that was cancelled.
          if (unsent) {
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (msgs[i].role === "user" && msgs[i].content === unsent.sentContent) {
                try { await api.deleteMessage(activeSession, i, unsent.sentContent); } catch { /* ignore */ }
                msgs = msgs.slice(0, i).concat(msgs.slice(i + 1));
                break;
              }
            }
          }
          setMessages(msgs);
          // Force output panel refresh so new files (images, PDFs) render immediately
          setOutputRefreshKey((k) => k + 1);
        });
        setStreaming("");
        // Remove completed task from running set (will be refreshed by polling)
        setRunningTaskIds((prev) => {
          if (prev.size === 0) return prev;
          // We don't know the exact taskId here, so let polling clean up.
          // But if only 1 task was running, clear it.
          if (prev.size === 1) return new Set();
          return prev;
        });
        setStatus("");
      }
    });
    const unsub3 = onStatus((data: any) => {
      // Track active task sessions for sidebar indicators
      if (data.sessionId && (data.status === "thinking" || data.status === "tool_call" || data.status === "running_python" || data.status === "retrying" || data.status === "realtime_agent_working" || data.status === "realtime_agent_tool")) {
        setActiveTaskSessions((prev) => {
          if (prev.has(data.sessionId)) return prev;
          const next = new Set(prev);
          next.add(data.sessionId);
          return next;
        });
      }

      // Only update loading/status UI for active session
      if (data.sessionId && data.sessionId !== activeSession) return;

      if (data.status === "thinking") {
        setStatus("Thinking...");
      } else if (data.status === "running_python") {
        setStatus("Running Python...");
      } else if (data.status === "tool_call") {
        const label = toolLabels[data.tool] || data.tool;
        if (data.tool === "send_task" && data.args) {
          const target = data.args.to || "agent";
          const taskPreview = data.args.task ? ` — ${data.args.task.slice(0, 60)}` : "";
          setStatus(`Delegating to ${target}${taskPreview}...`);
        } else if (data.tool === "wait_result" && data.args) {
          setStatus(`Waiting for ${data.args.from || "agent"} to finish...`);
        } else {
          setStatus(`${label}...`);
        }
      } else if (data.status === "tool_result") {
        const label = toolLabels[data.tool] || data.tool;
        if (data.tool === "wait_result") {
          setStatus("Agent result received, thinking...");
        } else if (data.tool === "send_task") {
          setStatus("Task delegated, orchestrating...");
        } else {
          setStatus(`${label} done, thinking...`);
        }
      } else if (data.status === "subagent_spawn") {
        setStatus(`Sub-agent "${data.label}" spawned...`);
      } else if (data.status === "subagent_tool") {
        const label = toolLabels[data.tool] || data.tool;
        setStatus(`Sub-agent "${data.label}": ${label}...`);
      } else if (data.status === "subagent_tool_done") {
        const label = toolLabels[data.tool] || data.tool;
        setStatus(`Sub-agent "${data.label}": ${label} done...`);
      } else if (data.status === "subagent_done") {
        setStatus(`Sub-agent "${data.label}" completed`);
      } else if (data.status === "subagent_error") {
        setStatus(`Sub-agent "${data.label}" failed: ${data.error}`);
      // ─── Realtime Agent status ───
      } else if (data.status === "realtime_agent_ready") {
        setStatus(`Agent "${data.label}" (${data.role}) ready`);
      } else if (data.status === "realtime_agent_working") {
        setStatus(`Agent "${data.label}" working — ${(data.task || "").slice(0, 80)}`);
      } else if (data.status === "realtime_agent_tool") {
        const label = data.tool === "error_recovery"
          ? "recovering from error"
          : toolLabels[data.tool] || data.tool;
        setStatus(`Agent "${data.label}": ${label}...`);
      } else if (data.status === "realtime_agent_tool_done") {
        // silent — keep current status
      } else if (data.status === "realtime_agent_done") {
        setStatus(`Agent "${data.label}" completed`);
      } else if (data.status === "running" && data.content) {
        setStatus(`📡 ${data.label}: ${(data.content || "").slice(0, 80)}`);
      } else if (data.status === "done" && data.label) {
        setStatus(`Agent "${data.label}" remote task completed`);
      } else if (data.status === "retrying") {
        setStatus(`Retrying (${data.attempt}/${data.maxRetries})...`);
      } else if (data.status === "job_complete") {
        // Orchestrator finished — refresh messages and output files
        if (data.sessionId === activeSession && activeSession) {
          api.getSession(activeSession).then((session: any) => {
            setMessages(session.messages || []);
            setOutputRefreshKey((k) => k + 1); // force output panel re-render
            setOutputPanelOpen(true); // auto-open output panel if files exist
          });
          setStatus("Job complete");
          setTimeout(() => setStatus(""), 3000);
        }
      } else if (data.status === "done") {
        // Clear active dot for this session
        if (data.sessionId) {
          setActiveTaskSessions((prev) => {
            const next = new Set(prev);
            next.delete(data.sessionId);
            return next;
          });
        }
        setRunningTaskIds(new Set());
        setStatus("");
      } else {
        setStatus("");
      }
    });
    return () => {
      unsub1(); unsub2(); unsub3();
      if (chunkFlushTimerRef.current) clearTimeout(chunkFlushTimerRef.current);
      chunkBufferRef.current = "";
    };
  }, [activeSession, onChunk, onResponse, onStatus]);

  // ── UX: restore an unsent message when a turn ends unsuccessfully ────
  // Fires on the thinking→idle transition. `isThinking` drops to false on
  // a real reply, on Stop, and on silent failures/disconnects. If a
  // genuine reply arrived, onResponse already cleared pendingSendRef, so
  // we skip. Otherwise (Stop / cancel / no reply) we put the user's text
  // + attachments back — but never clobber anything they've already
  // started typing for their next message.
  useEffect(() => {
    const thinking = runningTaskIds.size > 0 || !!streaming;
    if (wasThinkingRef.current && !thinking && pendingSendRef.current) {
      const pending = pendingSendRef.current;
      pendingSendRef.current = null;
      setInput((cur) => (cur.trim() ? cur : pending.text));
      setAttachedFiles((cur) => (cur.length ? cur : pending.files));
    }
    wasThinkingRef.current = thinking;
  }, [runningTaskIds, streaming]);

  // ─── Listen for auto-created architecture events ───
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock) return;
    const handler = (data: { sessionId: string; filename: string; systemName: string }) => {
      if (data.sessionId === activeSession) {
        setAutoCreatedArch({ filename: data.filename, systemName: data.systemName });
      }
    };
    sock.on("chat:architecture-created", handler);
    return () => { sock.off("chat:architecture-created", handler); };
  }, [activeSession, socketRef]);

  // ─── Activity log polling: fetch log file when panel is open ───
  useEffect(() => {
    if (!showActivityLog || !activeSession) { setActivityLogContent(""); return; }
    let cancelled = false;
    const fetchLog = () => {
      api.getActivityLog(activeSession).then((res: any) => {
        if (!cancelled && res.content) {
          const el = activityLogRef.current;
          const wasAtBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 40) : true;
          setActivityLogContent(res.content);
          if (wasAtBottom) {
            setTimeout(() => el?.scrollTo(0, el.scrollHeight), 50);
          }
        }
      }).catch(() => {});
    };
    fetchLog();
    const iv = setInterval(fetchLog, isLoading ? 2000 : 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [showActivityLog, activeSession, isLoading]);

  // ─── Chat log polling: fetch log file when panel is open ───
  useEffect(() => {
    if (!showChatLog || !activeSession) { setChatLogContent(""); return; }
    let cancelled = false;
    const fetchLog = () => {
      api.getChatLog(activeSession).then((res: any) => {
        if (!cancelled && res.content) {
          const el = chatLogRef.current;
          const wasAtBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 40) : true;
          setChatLogContent(res.content);
          if (wasAtBottom) {
            setTimeout(() => el?.scrollTo(0, el.scrollHeight), 50);
          }
        }
      }).catch(() => {});
    };
    fetchLog();
    const iv = setInterval(fetchLog, isLoading ? 2000 : 5000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [showChatLog, activeSession, isLoading]);

  // P-E / P1-v2: scroll-to-bottom button. The threshold accounts for
  // chat-messages's 180px padding-bottom (the area hidden behind the
  // absolute-positioned input bar). At the "visual bottom" of the
  // chat, distFromBottom ≈ 180. We require >240 so the button only
  // shows when the user has truly scrolled up. Also re-runs when
  // messages.length changes so the listener attaches the moment the
  // chat-messages div mounts (it doesn't exist when messages.length
  // === 0 — the chat-empty branch renders instead).
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) { setShowScrollBottom(false); return; }
    const onScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBottom(distFromBottom > 240);
    };
    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [activeSession, messages.length]);

  // Throttle scrollIntoView to at most once every 200ms to avoid layout thrashing
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!scrollTimerRef.current) {
      scrollTimerRef.current = setTimeout(() => {
        scrollTimerRef.current = null;
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 200);
    }
  }, [messages, streaming]);

  const createNewSession = async () => {
    const session = await api.createSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSession(session.id);
    setMessages([]);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const result = await api.chatUpload(Array.from(files));
      if (result.success && result.files) {
        setAttachedFiles((prev) => [...prev, ...result.files]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (idx: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSend = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    // Separate image attachments for multimodal API payload
    const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
    const imageAttachments = attachedFiles.filter((f) => imageExts.includes(getFileExt(f.name)));
    const nonImageAttachments = attachedFiles.filter((f) => !imageExts.includes(getFileExt(f.name)));

    // Build message with non-image attachment info
    let msg = input.trim();
    if (nonImageAttachments.length > 0) {
      const fileInfo = nonImageAttachments.map((f) => `[Attached file: ${f.name} (${f.type}, ${formatFileSize(f.size)}) saved at: ${f.path}]`).join("\n");
      msg = msg ? `${msg}\n\n${fileInfo}` : fileInfo;
    }
    // Add image file info as text context (the actual image is sent via multimodal payload)
    if (imageAttachments.length > 0) {
      const imgInfo = imageAttachments.map((f) => `[Image attached: ${f.name}]`).join("\n");
      msg = msg ? `${msg}\n\n${imgInfo}` : `What's in this image?\n\n${imgInfo}`;
    }

    // Build images payload for multimodal API
    const images = imageAttachments.map((f) => ({ path: f.path, type: f.type }));

    const userMessage: Message = {
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
      attachments: attachedFiles.length > 0 ? [...attachedFiles] : undefined,
    };

    // UX: remember what was sent so we can restore it if this turn is
    // stopped/cancelled or ends without a successful reply (see the
    // thinking→idle effect). Capture the raw text + a copy of the files
    // for restoring to the input box, plus `msg` (the exact persisted
    // content) so onResponse can find and delete that message on cancel.
    pendingSendRef.current = { text: input, files: [...attachedFiles], sentContent: msg };
    setInput("");
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Phase 4: pick the right socket event based on project selection.
    //   • projectId set → sendProjectMessage (backend loads project memory,
    //     skills, working folder)
    //   • no project   → sendMessage (global chat)
    // New sessions get a `[ProjectName] ` title prefix when project-scoped
    // so they show up in /project/:id's chat list and the sidebar's
    // Recents the same way the old code did.
    //
    // Recheck race fix: if a user arrives at /?project=ABC and hits Send
    // before loadProjects() finishes, the in-memory list is empty and
    // .find returns nothing — silently falling back to global chat and
    // losing the project context. Fetch the project on demand instead.
    let proj = selectedProjectId != null
      ? (projectsList || []).find((p) => String(p.id) === String(selectedProjectId))
      : null;
    if (selectedProjectId != null && !proj) {
      try {
        proj = await api.getProject(String(selectedProjectId));
      } catch {
        proj = null;
      }
    }

    if (!activeSession) {
      // P3: derive the session title from the first prompt so the
      // sidebar shows something meaningful instead of "New chat".
      const rawTitle = input.trim().slice(0, 50) || attachedFiles[0]?.name || "File upload";
      const title = proj ? `[${proj.name}] ${rawTitle}` : rawTitle;
      api.createSession(title).then((session: any) => {
        setSessions((prev) => [session, ...prev]);
        // Tell the session-load effect to leave our optimistic
        // messages alone — we created this session in this turn.
        freshlyCreatedRef.current = session.id;
        setActiveSession(session.id);
        setMessages([userMessage]);
        setRunningTaskIds((prev) => new Set([...prev, "pending-" + Date.now()]));
        if (proj) {
          sendProjectMessage(String(proj.id), session.id, msg, images.length > 0 ? images : undefined);
          // Once a project session is started, lock the chip so the
          // user can't reassign mid-conversation (the prefix would lie).
          setProjectLocked(true);
        } else {
          sendMessage(session.id, msg, images.length > 0 ? images : undefined);
        }
        // P3: navigate to the new session's URL so refreshes don't
        // lose the context, and refresh the sidebar so the new chat
        // appears immediately in RECENTS with the prompt-derived title.
        navigate(`/chat/${session.id}`);
        useConversationsStore.getState().loadConversations();
      });
    } else {
      setMessages((prev) => [...prev, userMessage]);
      setRunningTaskIds((prev) => new Set([...prev, "pending-" + Date.now()]));
      if (proj) {
        sendProjectMessage(String(proj.id), activeSession, msg, images.length > 0 ? images : undefined);
      } else {
        sendMessage(activeSession, msg, images.length > 0 ? images : undefined);
      }
    }
  }, [input, activeSession, sendMessage, sendProjectMessage, attachedFiles, selectedProjectId, projectsList]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const result = await api.chatUpload(Array.from(files));
      if (result.success && result.files) {
        setAttachedFiles((prev) => [...prev, ...result.files]);
      }
    } catch (err) {
      console.error("Drop upload failed:", err);
    }
    setUploading(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await api.deleteSession(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSession === id) {
      setActiveSession(null);
      setMessages([]);
    }
  };

  const isImageFile = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
  };

  return (
    <div className="chat-page">
      {/* Legacy chat-sidebar removed in Phase 2 polish — session list
          now lives in the global Sidebar (PINNED + RECENTS sections). */}
      <div className="chat-main" onDrop={handleDrop} onDragOver={handleDragOver}>
        <div className="chat-top-bar">
          <button
            className={`activity-log-toggle ${showActivityLog ? "active" : ""}`}
            onClick={() => { setShowActivityLog(v => !v); setShowChatLog(false); }}
            title={showActivityLog ? "Hide activity log" : "Show activity log"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            <span>Activity</span>
          </button>
          <button
            className={`activity-log-toggle ${showChatLog ? "active" : ""}`}
            onClick={() => { setShowChatLog(v => !v); setShowActivityLog(false); }}
            title={showChatLog ? "Hide chat log" : "Show chat log"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Log</span>
          </button>
          <button
            className="activity-log-toggle"
            onClick={async () => {
              if (!activeSession) return;
              try {
                const res: any = await api.getChatLog(activeSession);
                if (!res.content) { alert("No log content yet for this session."); return; }
                const blob = new Blob([res.content], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `chat-log-${activeSession}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err: any) {
                alert("Failed to export log: " + (err?.message || "unknown error"));
              }
            }}
            title="Export full chat log as .txt file"
            disabled={!activeSession}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Export</span>
          </button>
          {autoCreatedArch && (
            <button
              className="activity-log-toggle active"
              onClick={async () => {
                try {
                  const data = await api.getAgentConfig(autoCreatedArch.filename);
                  setAgentEditorYaml(data.content);
                  setAgentEditorFilename(autoCreatedArch.filename);
                  setShowAgentEditor(true);
                } catch {}
              }}
              title={`View auto-created architecture: ${autoCreatedArch.systemName}`}
              style={{ borderColor: "#8b5cf6", color: "#8b5cf6", background: "rgba(139, 92, 246, 0.15)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4m-7.07-2.93 2.83-2.83m8.48-8.48 2.83-2.83M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83"/>
              </svg>
              <span>{autoCreatedArch.systemName}</span>
            </button>
          )}
        </div>
        {showActivityLog && (
          <div className="activity-log-panel">
            <div className="activity-log-header">
              <span>Activity Log</span>
              {isLoading && <span className="activity-log-live">LIVE</span>}
            </div>
            <div className="activity-log-body" ref={activityLogRef}>
              {activityLogContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{activityLogContent}</ReactMarkdown>
              ) : (
                <div className="activity-log-empty">No activity yet. Run a task with agents to see logs here.</div>
              )}
            </div>
          </div>
        )}
        {showChatLog && (
          <div className="activity-log-panel">
            <div className="activity-log-header">
              <span>Chat Log</span>
              {isLoading && <span className="activity-log-live">LIVE</span>}
              <button
                onClick={() => {
                  if (!chatLogContent) return;
                  const blob = new Blob([chatLogContent], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `chat-log-${activeSession || "session"}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ marginLeft: "auto", padding: "2px 10px", fontSize: 11, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", cursor: "pointer" }}
                title="Save log as text file"
              >
                Save .txt
              </button>
            </div>
            <div className="activity-log-body" ref={chatLogRef} style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "pre-wrap" }}>
              {chatLogContent || "No chat log yet. Send a message to start recording."}
            </div>
          </div>
        )}
        {/* Phase 4 recheck — bug (b) fix:
            • If we're actively fetching an existing session, render
              "Loading chat…" (NOT the empty-state brand) so the user
              doesn't think their saved chat is a new empty one.
            • If the fetch failed, surface the error with a retry.
            • Otherwise behave as P3 did: brand when truly empty. */}
        {activeSession && sessionLoading ? (
          <div className="chat-empty">
            <p>Loading chat…</p>
          </div>
        ) : activeSession && sessionError ? (
          <div className="chat-empty">
            <h1 className="chat-empty-brand">Couldn't load chat</h1>
            <p>{sessionError}</p>
            <div className="chat-suggestions">
              <button
                className="suggestion-chip"
                onClick={() => {
                  // Force a reload by toggling activeSession (set null then back)
                  const id = activeSession;
                  setActiveSession(null);
                  setTimeout(() => setActiveSession(id), 0);
                }}
              >Retry</button>
              <button
                className="suggestion-chip"
                onClick={() => navigate("/")}
              >Back to new chat</button>
            </div>
          </div>
        ) : messages.length === 0 && !streaming ? (
          <div className="chat-empty">
            <h1 className="chat-empty-brand">
              CeTeau<span className="chat-empty-brand-accent"> | AI</span>
            </h1>
            <p>Start a conversation to get help with coding, run Python, manage files, and more.</p>
            <div className="chat-suggestions">
              {["Write a Python script to generate a PDF report", "Help me analyze a CSV file", "Build a React dashboard with charts", "Create a web scraper"].map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => { setInput(s); textareaRef.current?.focus(); }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages" ref={chatScrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {/* Avatars hidden via CSS — kept in DOM for legacy width math */}
                <div className="message-avatar">{msg.role === "user" ? "U" : "C"}</div>
                <div className="message-content">
                  {msg.role === "assistant" && humanFeedbackEnabled && (
                    <div className="feedback-bar">
                      <button
                        type="button"
                        title={msg.feedback?.rating === "up" ? "You marked this helpful — click to undo" : "Helpful"}
                        aria-pressed={msg.feedback?.rating === "up"}
                        disabled={feedbackBusy === i}
                        className={`feedback-btn up ${msg.feedback?.rating === "up" ? "active" : ""}`}
                        onClick={() => submitFeedback(i, msg.feedback?.rating === "up" ? { clear: true } : { rating: "up" })}
                      >
                        <span>👍</span>
                        {msg.feedback?.rating === "up" && <span className="check-mark">✓</span>}
                      </button>
                      <button
                        type="button"
                        title={msg.feedback?.rating === "down" ? "You marked this not helpful — click to undo" : "Not helpful"}
                        aria-pressed={msg.feedback?.rating === "down"}
                        disabled={feedbackBusy === i}
                        className={`feedback-btn down ${msg.feedback?.rating === "down" ? "active" : ""}`}
                        onClick={() => submitFeedback(i, msg.feedback?.rating === "down" ? { clear: true } : { rating: "down" })}
                      >
                        <span>👎</span>
                        {msg.feedback?.rating === "down" && <span className="check-mark">✓</span>}
                      </button>
                      <button
                        type="button"
                        title={msg.feedback?.comment ? "Edit your comment" : "Add a comment"}
                        aria-pressed={!!msg.feedback?.comment}
                        className={`feedback-btn comment ${msg.feedback?.comment ? "active" : ""}`}
                        onClick={() => {
                          if (feedbackOpen === i) { setFeedbackOpen(null); setFeedbackDraft(""); }
                          else { setFeedbackOpen(i); setFeedbackDraft(msg.feedback?.comment || ""); }
                        }}
                      >
                        <span>💬</span>
                        <span style={{ fontSize: 12 }}>{msg.feedback?.comment ? "Edit comment" : "Comment"}</span>
                        {msg.feedback?.comment && <span className="check-mark">✓</span>}
                      </button>
                      {msg.feedback?.submittedAt && (
                        <span className="feedback-saved">
                          saved for skill update · {new Date(msg.feedback.submittedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  )}
                  {msg.role === "assistant" && humanFeedbackEnabled && msg.feedback?.comment && feedbackOpen !== i && (
                    <div className="feedback-saved-comment">{msg.feedback.comment}</div>
                  )}
                  {msg.role === "assistant" && humanFeedbackEnabled && feedbackOpen === i && (
                    <div className="feedback-editor">
                      <textarea
                        value={feedbackDraft}
                        onChange={(e) => setFeedbackDraft(e.target.value)}
                        placeholder="What worked or didn't? This is fed into the skill synthesiser."
                      />
                      <div className="feedback-editor-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          disabled={feedbackBusy === i}
                          onClick={async () => {
                            await submitFeedback(i, { comment: feedbackDraft });
                            setFeedbackOpen(null);
                            setFeedbackDraft("");
                          }}
                        >Save comment</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setFeedbackOpen(null); setFeedbackDraft(""); }}
                        >Cancel</button>
                        {msg.feedback?.comment && (
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={feedbackBusy === i}
                            onClick={async () => {
                              await submitFeedback(i, { comment: "" });
                              setFeedbackOpen(null);
                              setFeedbackDraft("");
                            }}
                          >Clear</button>
                        )}
                      </div>
                    </div>
                  )}
                  {msg.role === "assistant" ? (
                    <>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{msg.content}</ReactMarkdown>
                      {msg.files && msg.files.length > 0 && (
                        <div className="message-output-indicator" onClick={() => setOutputPanelOpen(true)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                          {msg.files.length} output{msg.files.length > 1 ? "s" : ""} — view in panel
                        </div>
                      )}
                      <div className="message-actions">
                        <CopyButton text={msg.content} />
                      </div>
                    </>
                  ) : (
                    <>
                      {/* P-C: attached files render as chips ABOVE the bubble, not inline */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="user-attachments-row">
                          {msg.attachments.map((f, j) => (
                            <div key={j} className="user-attachment-chip">
                              {isImageFile(f.name) ? (
                                <img src={sandboxUrl(f.path)} alt={f.name} className="chip-thumb" />
                              ) : (
                                <>
                                  <div className="chip-icon">{getFileIcon(f.name)}</div>
                                  <span className="chip-name">{f.name}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* P-B: user bubble with 200px cap + fade + Show more */}
                      <UserMessageBubble
                        content={msg.content
                          .replace(/\[Attached file:.*?\]/g, "")
                          .replace(/\[Image attached:.*?\]/g, "")
                          .trim()}
                      />
                      <div className="message-actions">
                        <CopyButton text={msg.content} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="message assistant">
                <div className="message-avatar">C</div>
                <div className="message-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{streaming}</ReactMarkdown>
                </div>
              </div>
            )}
            {status && <div className="chat-status">{status}</div>}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* P-E / P1-v2: floating scroll-to-bottom button. Only renders
            when (a) we have at least one message and (b) the user has
            scrolled up. Backdrop-blur so the chat shows through softly. */}
        {showScrollBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="scroll-to-bottom-btn"
            title="Scroll to latest"
            aria-label="Scroll to latest message"
          >
            <ChevronDown size={16} />
          </button>
        )}

        <div className="chat-input-container">
          {/* Hidden file input — triggered by ChatInputBar's Plus button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.json,.xml,.png,.jpg,.jpeg,.gif,.webp,.svg,.bmp,.py,.js,.ts,.html,.css,.md,.yaml,.yml,.zip,.tar,.gz"
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          {/* Attached files preview — still rendered above the input bar */}
          {attachedFiles.length > 0 && (
            <div className="attachments-preview">
              {attachedFiles.map((f, i) => (
                <div key={i} className="attachment-preview-item">
                  {isImageFile(f.name) ? (
                    <img src={sandboxUrl(f.path)} alt={f.name} className="attachment-thumb" />
                  ) : (
                    <div className="attachment-preview-icon">{getFileIcon(f.name)}</div>
                  )}
                  <span className="attachment-preview-name">{f.name}</span>
                  <button className="attachment-remove" onClick={() => removeAttachment(i)}>&times;</button>
                </div>
              ))}
            </div>
          )}

          {/* New two-row chat input — replaces the legacy single-row layout */}
          <ChatInputBar
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onAttachClick={() => fileInputRef.current?.click()}
            canSend={!!input.trim() || attachedFiles.length > 0}
            uploading={uploading}
            // P1: when the assistant is responding, the input bar
            // swaps Send for Stop. The flag is true while we have any
            // running task for the active session OR a streaming chunk.
            isThinking={runningTaskIds.size > 0 || !!streaming}
            onStop={async () => {
              // P5: stop button kills every running task for the
              // active session, then clears local loading state.
              try {
                const ids = Array.from(runningTaskIds);
                await Promise.all(ids.map((tid) => api.killActiveTask(tid).catch(() => {})));
              } catch { /* ignore */ }
              setRunningTaskIds(new Set());
              setStreaming("");
              setStatus("");
            }}
            // Phase 4: project chip wiring. The chip:
            //   • is hidden if `projects` is undefined,
            //   • shows the selected project name (or "Project") otherwise,
            //   • is locked once the session has a [Name] prefix.
            projects={chipProjects}
            selectedProjectId={selectedProjectId}
            onProjectChange={(id) => setSelectedProjectId(id)}
            projectLocked={projectLocked}
          />
        </div>
      </div>

      {/* Right-side Output Panel */}
      {allOutputFiles.length > 0 && outputPanelOpen && (
        <div className="output-panel">
          <div className="output-panel-header">
            <h3>Outputs</h3>
            <button className="btn-icon btn-ghost" onClick={() => setOutputPanelOpen(false)}>
              <Icon name="close" />
            </button>
          </div>
          <div className="output-panel-content">
            {allOutputFiles.map((group, gi) => (
              <OutputCanvas key={`${gi}-${outputRefreshKey}`} files={group.files} />
            ))}
          </div>
        </div>
      )}

      {/* Toggle button when panel is closed but outputs exist */}
      {allOutputFiles.length > 0 && !outputPanelOpen && (
        <button className="output-panel-toggle" onClick={() => setOutputPanelOpen(true)} title="Show outputs">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
          <span className="output-toggle-badge">{allOutputFiles.reduce((n, g) => n + g.files.length, 0)}</span>
        </button>
      )}

      {/* Agent Editor modal for viewing auto-created architectures */}
      {showAgentEditor && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading editor...</div>}>
          <AgentEditor
            onClose={() => { setShowAgentEditor(false); setAgentEditorYaml(undefined); setAgentEditorFilename(undefined); }}
            onSave={(filename: string, content: string) => {
              api.saveAgentConfig(filename, content);
              setShowAgentEditor(false);
              setAgentEditorYaml(undefined);
              setAgentEditorFilename(undefined);
            }}
            initialYaml={agentEditorYaml}
            initialFilename={agentEditorFilename}
          />
        </Suspense>
      )}
    </div>
  );
}
