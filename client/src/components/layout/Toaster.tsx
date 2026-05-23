import { useEffect, useState } from "react";
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { subscribe, getToasts, dismiss, type Toast } from "../../lib/toast";

// Global toast renderer. Mounted once at the root of <App>. Subscribes
// to the toast pub/sub queue and re-renders whenever toasts change.
//
// Visually: a fixed bottom-right stack of cards, each colored by kind.
// Tailwind classes resolve through the CeTeau token system from Phase 1.

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
} as const;

const KIND_STYLES = {
  success: "border-success/40 bg-success/10  text-success",
  error:   "border-error/40   bg-error/10    text-error",
  warning: "border-warning/40 bg-warning/10  text-warning",
  info:    "border-accent/40  bg-accent/10   text-accent",
} as const;

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>(getToasts());

  useEffect(() => {
    const unsubscribe = subscribe(() => setToasts([...getToasts()]));
    return () => { unsubscribe(); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 min-w-[260px] max-w-sm px-3 py-2 rounded-lg border bg-bg-surface shadow-md ${KIND_STYLES[t.kind]}`}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 text-[13px] leading-snug text-fg-base">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="shrink-0 text-fg-subtle hover:text-fg-base transition-colors"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
