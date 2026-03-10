import Link from "next/link";
import Container from "./ui/Container";

const navItems = [
  { href: "/", label: "메인" },
  { href: "/hackathons", label: "해커톤" },
  { href: "/camp", label: "팀 찾기" },
  { href: "/rankings", label: "랭킹" },
];

export default function Navbar() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <Container>
        <div
          style={{
            minHeight: "72px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            Daker Hackathon Hub
          </Link>

          <nav
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  color: "#374151",
                  fontWeight: 700,
                  fontSize: "14px",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </header>
  );
}