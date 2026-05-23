import { useState, useEffect, useRef } from "react";
import { Copy, Check } from "lucide-react";

// ── UserMessageBubble ────────────────────────────────────────────────
// Renders the user's message text inside the blue chat bubble. Caps
// the rendered height at 200px; when the actual content exceeds the
// cap, fades the bottom and shows a "Show more / Show less" toggle.
//
// State is local to each instance so collapsing one message doesn't
// affect any other — ChatPage doesn't have to track expansion state.
export function UserMessageBubble({ content }: { content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [needsTruncation, setNeedsTruncation] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    // Temporarily clear the cap so scrollHeight reflects full content
    // (not the capped height), then restore.
    const prevMax = el.style.maxHeight;
    el.style.maxHeight = "none";
    const full = el.scrollHeight;
    el.style.maxHeight = prevMax;
    setNeedsTruncation(full > 200);
  }, [content]);

  return (
    <>
      <div
        ref={ref}
        className={`user-bubble ${expanded ? "expanded" : ""} ${needsTruncation && !expanded ? "truncated" : ""}`}
      >
        {content}
      </div>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="show-more-btn"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

// ── CopyButton ───────────────────────────────────────────────────────
// Generic copy-to-clipboard button used in the per-message action row.
// Shows a "Copied" confirmation briefly after a successful copy.
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore — clipboard might be blocked */ }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="msg-action-btn"
      title="Copy message"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      <span>{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
