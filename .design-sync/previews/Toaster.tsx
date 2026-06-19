import { Toaster, notify } from "cowork-client";

// The global toast renderer (mounted once at the app root). It subscribes to the
// module-scoped toast queue; here we seed one of each kind via `notify` so the
// fixed bottom-right stack renders all four severity styles. durationMs=0 keeps
// them from auto-dismissing during the static capture. The card is given an
// explicit app-canvas backdrop sized to the viewport so the `fixed` toasts
// anchor to the card's bottom-right corner instead of escaping the page.
notify.success("Project “Atlas” saved successfully", 0);
notify.info("3 new files synced from the sandbox", 0);
notify.warning("Your session will expire in 5 minutes", 0);
notify.error("Failed to connect to the agent runtime", 0);

export function AllKinds() {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 340,
        background: "var(--bg-tertiary)",
        overflow: "hidden",
        fontFamily: "Google Sans, Noto Sans Thai, Roboto, system-ui, sans-serif",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          fontSize: 12,
          color: "var(--text-tertiary)",
        }}
      >
        Toast notifications (bottom-right)
      </span>
      <Toaster />
    </div>
  );
}
