import type { ReactNode } from "react";

type StateKind = "loading" | "empty" | "error";

const STATE_META: Record<StateKind, { label: string; background: string; border: string; color: string }> = {
  loading: {
    label: "로딩중",
    background: "#f8fafc",
    border: "#e5e7eb",
    color: "#475569",
  },
  empty: {
    label: "데이터 없음",
    background: "#f8fafc",
    border: "#e5e7eb",
    color: "#6b7280",
  },
  error: {
    label: "Error",
    background: "#fef2f2",
    border: "#fecaca",
    color: "#b91c1c",
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
        borderRadius: compact ? "18px" : "24px",
        background: meta.background,
        border: `1px solid ${meta.border}`,
        padding: compact ? "18px" : "24px",
        color: meta.color,
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 800, marginBottom: "8px", color: meta.color }}>
        {meta.label}
      </div>
      <div style={{ fontSize: compact ? "16px" : "18px", fontWeight: 800, marginBottom: description ? "6px" : 0 }}>
        {title}
      </div>
      {description ? (
        <div style={{ fontSize: "14px", lineHeight: 1.7, color: meta.color }}>{description}</div>
      ) : null}
      {action ? <div style={{ marginTop: "14px" }}>{action}</div> : null}
    </div>
  );
}
