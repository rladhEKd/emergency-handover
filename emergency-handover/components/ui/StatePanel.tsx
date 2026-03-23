import type { ReactNode } from "react";

type StateKind = "loading" | "empty" | "error";

const STATE_META: Record<
  StateKind,
  { label: string; background: string; border: string; color: string; accent: string }
> = {
  loading: {
    label: "로딩중",
    background: "#f8fbff",
    border: "#dbeafe",
    color: "#1d4ed8",
    accent: "rgba(37, 99, 235, 0.08)",
  },
  empty: {
    label: "안내",
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
    accent: "rgba(148, 163, 184, 0.12)",
  },
  error: {
    label: "오류",
    background: "#fff5f5",
    border: "#fecaca",
    color: "#b91c1c",
    accent: "rgba(239, 68, 68, 0.1)",
  },
};

export default function StatePanel({
  kind,
  title,
  description,
  compact = false,
  action,
}: {
  kind: StateKind;
  title: string;
  description?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  const meta = STATE_META[kind];

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: compact ? "20px" : "26px",
        background: meta.background,
        border: `1px solid ${meta.border}`,
        padding: compact ? "20px" : "26px",
        color: meta.color,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(circle at top right, ${meta.accent}, transparent 28%)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative" }}>
        <div style={{ fontSize: "12px", fontWeight: 800, marginBottom: "10px", color: meta.color, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {meta.label}
        </div>
        <div style={{ fontSize: compact ? "17px" : "20px", fontWeight: 900, lineHeight: 1.35, color: "#0f172a", marginBottom: description ? "8px" : 0 }}>
          {title}
        </div>
        {description ? (
          <div style={{ fontSize: "14px", lineHeight: 1.75, color: "#475569" }}>{description}</div>
        ) : null}
        {action ? <div style={{ marginTop: "16px" }}>{action}</div> : null}
      </div>
    </div>
  );
}
