"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

type Team = {
  isOpen: boolean;
};

type HomeStatsCardsProps = {
  publicHackathonCount: number;
  publicOpenTeamCount: number;
  publicRankingCount: number;
};

function countOpenTeamsFromStorage(publicOpenTeamCount: number) {
  if (typeof window === "undefined") return publicOpenTeamCount;

  try {
    const raw = window.localStorage.getItem("teams");
    if (!raw) return publicOpenTeamCount;

    const parsed = JSON.parse(raw) as Team[];
    if (!Array.isArray(parsed)) return publicOpenTeamCount;

    return parsed.filter((team) => team?.isOpen).length;
  } catch {
    return publicOpenTeamCount;
  }
}

export default function HomeStatsCards({
  publicHackathonCount,
  publicOpenTeamCount,
  publicRankingCount,
}: HomeStatsCardsProps) {
  const [openTeamCount, setOpenTeamCount] = useState(publicOpenTeamCount);

  useEffect(() => {
    function syncStats() {
      setOpenTeamCount(countOpenTeamsFromStorage(publicOpenTeamCount));
    }

    syncStats();
    window.addEventListener("storage", syncStats);
    window.addEventListener("focus", syncStats);

    return () => {
      window.removeEventListener("storage", syncStats);
      window.removeEventListener("focus", syncStats);
    };
  }, [publicOpenTeamCount]);

  return (
    <div
      style={{
        marginTop: "26px",
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
      }}
    >
      <Link
        href="/hackathons"
        className={styles.heroStatLink}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            borderRadius: "18px",
            padding: "18px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.14)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "13px", opacity: 0.85 }}>해커톤</div>
          <div style={{ fontSize: "28px", fontWeight: 900 }}>
            {publicHackathonCount}
          </div>
        </div>
      </Link>

      <Link
        href="/camp"
        className={styles.heroStatLink}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            borderRadius: "18px",
            padding: "18px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.14)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "13px", opacity: 0.85 }}>모집 중인 팀</div>
          <div style={{ fontSize: "28px", fontWeight: 900 }}>
            {openTeamCount}
          </div>
        </div>
      </Link>

      <Link
        href="/rankings"
        className={styles.heroStatLink}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            borderRadius: "18px",
            padding: "18px",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.14)",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: "13px", opacity: 0.85 }}>랭킹</div>
          <div style={{ fontSize: "28px", fontWeight: 900 }}>
            {publicRankingCount}
          </div>
        </div>
      </Link>
    </div>
  );
}
