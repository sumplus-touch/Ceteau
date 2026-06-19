import { CopyButton } from "cowork-client";

// The copy-to-clipboard control from the per-message action row. Transparent by
// default; on a surface it reads as a quiet secondary action. Swaps to a "Copied"
// check confirmation after a successful copy (transient — not shown statically).
export function Default() {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--bg-primary)",
        fontFamily: "Google Sans, Noto Sans Thai, Roboto, system-ui, sans-serif",
      }}
    >
      <CopyButton text="npm install cowork-client" />
    </div>
  );
}

export function InActionRow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "10px 16px",
        background: "var(--bg-primary)",
        borderTop: "1px solid var(--border)",
        fontFamily: "Google Sans, Noto Sans Thai, Roboto, system-ui, sans-serif",
      }}
    >
      <CopyButton text="The assistant's full reply, copied verbatim to the clipboard." />
      <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>· assistant · 2:41 PM</span>
    </div>
  );
}
