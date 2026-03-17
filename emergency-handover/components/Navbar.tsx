"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, getCurrentSession, logout } from "../lib/local-auth";
import Container from "./ui/Container";
import styles from "./Navbar.module.css";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/hackathons", label: "Hackathons" },
  { href: "/camp", label: "Camp" },
  { href: "/rankings", label: "Rankings" },
];

export default function Navbar() {
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    function syncSession() {
      const session = getCurrentSession();
      setNickname(session?.nickname ?? "");
    }

    syncSession();
    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  function handleLogout() {
    logout();
    setNickname("");
  }

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
            padding: "0 100px",
          }}
        >
          <Link
            href="/"
            className={styles.logo}
            style={{
              fontSize: "22px",
              fontWeight: 900,
              color: "#111827",
              textDecoration: "none",
            }}
          >
            Hackathon Hub
          </Link>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
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
                  className={styles.navItem}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    color: "#374151",
                    fontWeight: 700,
                    fontSize: "14px",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {nickname ? (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href="/dashboard"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    color: "#111827",
                    fontWeight: 800,
                    fontSize: "14px",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  {nickname}
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href="/auth?mode=login"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    color: "#374151",
                    fontWeight: 700,
                    fontSize: "14px",
                    textDecoration: "none",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                  }}
                >
                  Login
                </Link>
                <Link
                  href="/auth?mode=signup"
                  style={{
                    padding: "10px 14px",
                    borderRadius: "12px",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "14px",
                    textDecoration: "none",
                    border: "1px solid #2563eb",
                    background: "#2563eb",
                  }}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
