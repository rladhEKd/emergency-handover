import styles from "./page.module.css";
import Link from "next/link";
import hackathonsData from "../data/public_hackathons.json";
import teamsData from "../data/public_teams.json";
import leaderboardData from "../data/public_leaderboard.json";
import HomeStatsCards from "./HomeStatsCards";

type Hackathon = {
  slug: string;
  title: string;
  status: "ended" | "ongoing" | "upcoming";
  tags: string[];
  period: {
    submissionDeadlineAt: string;
    endAt: string;
  };
};

type Team = {
  teamCode: string;
  hackathonSlug: string;
  name: string;
  isOpen: boolean;
  memberCount: number;
  lookingFor: string[];
  intro: string;
};

type LeaderboardEntry = {
  rank: number;
  teamName: string;
  score: number;
};

type Leaderboard = {
  hackathonSlug: string;
  entries: LeaderboardEntry[];
};

type LeaderboardData = Leaderboard & {
  extraLeaderboards?: Leaderboard[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusLabel(status: Hackathon["status"]) {
  if (status === "ongoing") return "진행중";
  if (status === "upcoming") return "예정";
  return "종료";
}

function getStatusStyle(status: Hackathon["status"]) {
  if (status === "ongoing") {
    return { backgroundColor: "#e8f7ea", color: "#1f7a35" };
  }
  if (status === "upcoming") {
    return { backgroundColor: "#eaf2ff", color: "#2457c5" };
  }
  return { backgroundColor: "#f3f4f6", color: "#4b5563" };
}

function getHackathonTitle(slug: string) {
  switch (slug) {
    case "aimers-8-model-lite":
      return "Aimers 8기 : 모델 경량화 온라인 해커톤";
    case "monthly-vibe-coding-2026-02":
      return "월간 해커톤 : 바이브 코딩 개선 AI 아이디어 공모전";
    case "daker-handover-2026-03":
      return "긴급 인수인계 해커톤: 명세서만 보고 구현하라";
    default:
      return slug;
  }
}

export default function HomePage() {
  const hackathons = hackathonsData as Hackathon[];
  const teams = teamsData as Team[];
  const leaderboard = leaderboardData as LeaderboardData;

  const recentHackathons = hackathons.slice(0, 3);
  const openTeams = teams.filter((team) => team.isOpen).slice(0, 2);

  const allBoards: Leaderboard[] = [
    {
      hackathonSlug: leaderboard.hackathonSlug,
      entries: leaderboard.entries,
    },
    ...(leaderboard.extraLeaderboards ?? []),
  ];

  const topTeams = allBoards
    .map((board) => ({
      hackathonSlug: board.hackathonSlug,
      entry: board.entries[0],
    }))
    .filter((item) => item.entry)
    .slice(0, 2);

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "24px 20px 72px",
      }}
    >
      {/* HERO */}
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "32px",
          padding: "52px 40px 40px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
          color: "#ffffff",
          boxShadow: "0 24px 60px rgba(30, 58, 138, 0.25)",
          marginBottom: "28px",
        }}
      >
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "999px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: "13px",
              fontWeight: 800,
              marginBottom: "18px",
            }}
          >
            HACKATHON PLATFORM
          </div>

          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "42px",
              lineHeight: 1.14,
              fontWeight: 900,
              maxWidth: "640px",
            }}
          >
            Hackathon Hub
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: "640px",
              fontSize: "17px",
              lineHeight: 1.7,
              color: "rgba(255,255,255,0.9)",
            }}
          >
            다양한 해커톤을 탐색하고 팀을 모집하거나 랭킹을 확인할 수 있는 올인원 플랫폼입니다.
            <br />
            쉽고 빠르게 해커톤에 참여해보세요.
          </p>

          {/* STAT CARDS */}
          <HomeStatsCards
            publicHackathonCount={hackathons.length}
            publicOpenTeamCount={teams.filter((team) => team.isOpen).length}
            publicRankingCount={allBoards.length}
          />
        </div>
      </section>

      {/* CONTENT */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.25fr 0.95fr",
          gap: "20px",
        }}
      >
        {/* 최근 해커톤 */}
        <div
          className={styles.sectionPanel}
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "28px",
            padding: "28px",
          }}
        >
          <h2 style={{ margin: "0 0 18px", fontSize: "26px", fontWeight: 900 }}>
            최근 해커톤
          </h2>

          <div style={{ display: "grid", gap: "14px" }}>
            {recentHackathons.map((hackathon) => (
              <Link
                key={hackathon.slug}
                href={`/hackathons/${hackathon.slug}`}
                className={styles.contentCardLink}
              >
                <article
                  style={{
                    border: "1px solid #edf0f5",
                    background: "#fbfcfe",
                    borderRadius: "20px",
                    padding: "20px",
                  }}
                >
                  <span
                    style={{
                      padding: "6px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: 800,
                      ...getStatusStyle(hackathon.status),
                    }}
                  >
                    {getStatusLabel(hackathon.status)}
                  </span>

                  <h3 style={{ margin: "12px 0", fontSize: "20px", fontWeight: 900 }}>
                    {hackathon.title}
                  </h3>

                  <p style={{ margin: 0, color: "#6b7280" }}>
                    제출 마감 · {formatDate(hackathon.period.submissionDeadlineAt)}
                  </p>
                </article>
              </Link>
            ))}
          </div>
        </div>

        {/* 팀 + 랭킹 */}
        <div style={{ display: "grid", gap: "20px" }}>
          <div
            className={styles.sectionPanel}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "28px",
              padding: "24px",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: "26px", fontWeight: 900 }}>
              모집 중인 팀
            </h2>

            <div style={{ display: "grid", gap: "12px" }}>
              {openTeams.map((team) => (
                <Link
                  key={team.teamCode}
                  href={`/camp?hackathon=${team.hackathonSlug}`}
                  className={styles.contentCardLink}
                >
                  <article
                    style={{
                      borderRadius: "18px",
                      padding: "18px",
                      background: "#fbfcfe",
                      border: "1px solid #edf0f5",
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                      {team.name}
                    </h3>
                    <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
                      {getHackathonTitle(team.hackathonSlug)}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          </div>

          <div
            className={styles.sectionPanel}
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "28px",
              padding: "24px",
            }}
          >
            <h2 style={{ margin: "0 0 18px", fontSize: "26px", fontWeight: 900 }}>
              상위 팀 미리보기
            </h2>

            <div style={{ display: "grid", gap: "12px" }}>
              {topTeams.map((item) => (
                <Link
                  key={item.hackathonSlug}
                  href="/rankings"
                  className={styles.contentCardLink}
                >
                  <article
                    style={{
                      borderRadius: "18px",
                      padding: "18px",
                      background: "#fbfcfe",
                      border: "1px solid #edf0f5",
                    }}
                  >
                    <p style={{ margin: "0 0 6px", color: "#2563eb", fontWeight: 800 }}>
                      {getHackathonTitle(item.hackathonSlug)}
                    </p>
                    <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                      1위 {item.entry.teamName}
                    </h3>
                    <p style={{ margin: 0, color: "#6b7280" }}>
                      점수 {item.entry.score}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}