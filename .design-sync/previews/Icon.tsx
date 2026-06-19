import { Icon } from "cowork-client";

// The built-in inline-SVG icon set. Each tile renders one named icon tinted
// with the CeTeau accent token so the gallery doubles as a name reference.
const NAMES = [
  "chat", "folder", "schedule", "extension", "settings",
  "project", "menu", "close", "add",
];

export function IconGallery() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
        padding: 24,
        background: "var(--bg-secondary)",
        fontFamily: "Google Sans, Noto Sans Thai, Roboto, system-ui, sans-serif",
      }}
    >
      {NAMES.map((name) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "16px 8px",
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 10,
          }}
        >
          <span style={{ color: "var(--accent)", display: "inline-flex" }}>
            <Icon name={name} />
          </span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{name}</span>
        </div>
      ))}
    </div>
  );
}
