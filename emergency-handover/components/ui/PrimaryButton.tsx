import Link from "next/link";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "ghost";
};

export default function PrimaryButton({
  href,
  children,
  variant = "solid",
}: Props) {
  const solid = variant === "solid";

  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px 18px",
        borderRadius: "14px",
        fontWeight: 800,
        fontSize: "15px",
        textDecoration: "none",
        backgroundColor: solid ? "#2563eb" : "transparent",
        color: solid ? "#ffffff" : "#1f2937",
        border: solid ? "none" : "1px solid #d1d5db",
      }}
    >
      {children}
    </Link>
  );
}