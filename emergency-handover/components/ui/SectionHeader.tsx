export default function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      {eyebrow && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#2563eb",
          }}
        >
          {eyebrow}
        </p>
      )}

      <h2
        style={{
          margin: "0 0 10px",
          fontSize: "32px",
          fontWeight: 900,
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>

      {description && (
        <p
          style={{
            margin: 0,
            color: "#6b7280",
            lineHeight: 1.7,
            maxWidth: "780px",
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}