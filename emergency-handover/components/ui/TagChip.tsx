export default function TagChip({ label }: { label: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "8px 12px",
        borderRadius: "999px",
        backgroundColor: "#eef4ff",
        color: "#2457c5",
        fontSize: "13px",
        fontWeight: 700,
      }}
    >
      #{label}
    </span>
  );
}