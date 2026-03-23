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

  const items = [
    {
      href: "/hackathons",
      label: "해커톤",
      value: publicHackathonCount,
      description: "현재 열려 있는 해커톤과 마감 일정을 확인합니다.",
    },
    {
      href: "/camp",
      label: "모집중인 팀",
      value: openTeamCount,
      description: "지금 참여할 수 있는 팀 모집글을 빠르게 찾습니다.",
    },
    {
      href: "/rankings",
      label: "랭킹",
      value: publicRankingCount,
      description: "글로벌 랭킹과 해커톤별 리더보드를 확인합니다.",
    },
  ];

  return (
    <div className={styles.homeStatsGrid}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} className={`interactive-card ${styles.heroStatLink}`}>
          <div className={styles.heroStatCard}>
            <span className={styles.heroStatLabel}>{item.label}</span>
            <strong className={styles.heroStatValue}>{item.value}</strong>
            <span className={styles.heroStatCopy}>{item.description}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
