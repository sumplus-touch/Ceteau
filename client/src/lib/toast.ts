// Lightweight global toast queue. The Toaster component subscribes
// and renders; anyone can call notify.success / .error / .info to
// push a transient message without prop-drilling through providers.
//
// Intentionally tiny: no provider, no context, no React Query. Just
// a module-scoped array + a Set of subscribers that re-render when
// the queue changes.

export type ToastKind = "success" | "error" | "info" | "warning";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after N ms. 0 disables. Default 4000. */
  durationMs?: number;
}

let nextId = 1;
let queue: Toast[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getToasts(): Toast[] {
  return queue;
}

function push(kind: ToastKind, message: string, durationMs = 4000): number {
  const id = nextId++;
  queue = [...queue, { id, kind, message, durationMs }];
  emit();
  if (durationMs > 0) {
    setTimeout(() => dismiss(id), durationMs);
  }
  return id;
}

export function dismiss(id: number) {
  const before = queue.length;
  queue = queue.filter((t) => t.id !== id);
  if (queue.length !== before) emit();
}

export const notify = {
  success: (msg: string, ms?: number) => push("success", msg, ms),
  error:   (msg: string, ms?: number) => push("error",   msg, ms),
  info:    (msg: string, ms?: number) => push("info",    msg, ms),
  warning: (msg: string, ms?: number) => push("warning", msg, ms),
};
