import { UserMessageBubble } from "cowork-client";

// The blue user message bubble as it appears in the chat column — right-aligned,
// CeTeau-accent background. Long content fades at the bottom and reveals a
// "Show more" toggle (see the LongMessage cell).
function ChatColumn({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
        width: 520,
        maxWidth: "100%",
        padding: 24,
        marginLeft: "auto",
        background: "var(--bg-secondary)",
        fontFamily: "Google Sans, Noto Sans Thai, Roboto, system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}

export function ShortMessage() {
  return (
    <ChatColumn>
      <UserMessageBubble content="Can you summarize the latest agent run and list any tasks that failed?" />
    </ChatColumn>
  );
}

export function LongMessage() {
  const long = [
    "Please review the deployment plan and flag anything risky before we ship.",
    "We're rolling the new chat input bar, the project memory feature, and the",
    "sub-agent swarm mode all in the same release, so I want a second pass on the",
    "migration order. Also double-check the socket reconnect logic under load —",
    "last time it dropped events when more than ten agents were active at once.",
    "Confirm the rollback path is one command and document it in the runbook.",
    "While you're in there, audit the project-scoped memory writes for races,",
    "verify the sandbox file-sync handles 204 responses, and make sure the",
    "sub-agent cascade menu still opens leftward at the right viewport edge.",
    "This bubble is intentionally long so it exceeds the 200px cap, fades at the",
    "bottom, and reveals the Show more / Show less toggle beneath it.",
  ].join(" ");
  return (
    <ChatColumn>
      <UserMessageBubble content={long} />
    </ChatColumn>
  );
}
