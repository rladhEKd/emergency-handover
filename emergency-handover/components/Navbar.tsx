"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUTH_CHANGED_EVENT, getCurrentSession, logout } from "../lib/local-auth";
import Container from "./ui/Container";
import styles from "./Navbar.module.css";

const navItems = [
  { href: "/", label: "홈" },
  { href: "/hackathons", label: "해커톤" },
  { href: "/camp", label: "팀원 모집" },
  { href: "/rankings", label: "랭킹" },
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
    <header className={styles.header}>
      <Container>
        <div className={styles.bar}>
          <Link href="/" className={styles.brand}>
            <span className={styles.logo}>Hackathon Hub</span>
          </Link>

          <div className={styles.navWrap}>
            <nav className={styles.nav}>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className={styles.navItem}>
                  {item.label}
                </Link>
              ))}
            </nav>

            {nickname ? (
              <div className={styles.actions}>
                <Link href="/dashboard" className={styles.nickname}>
                  {nickname}
                </Link>
                <button type="button" onClick={handleLogout} className={styles.logout}>
                  Logout
                </button>
              </div>
            ) : (
              <div className={styles.actions}>
                <Link href="/auth?mode=login" className={styles.authLink}>
                  Login
                </Link>
                <Link href="/auth?mode=signup" className={`${styles.authLink} ${styles.authLinkPrimary}`}>
                  {"회원가입"}
                </Link>
              </div>
            )}
          </div>
        </div>
      </Container>
    </header>
  );
}
