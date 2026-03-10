import Link from "next/link";
import hackathonsData from "../data/public_hackathons.json";
import teamsData from "../data/public_teams.json";
import leaderboardData from "../data/public_leaderboard.json";

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
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "32px",
          padding: "52px 40px 34px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
          color: "#ffffff",
          boxShadow: "0 24px 60px rgba(30, 58, 138, 0.25)",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-40px",
            top: "-30px",
            width: "220px",
            height: "220px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: "120px",
            bottom: "-70px",
            width: "180px",
            height: "180px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.06)",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "999px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: "13px",
              fontWeight: 800,
              letterSpacing: "0.04em",
              marginBottom: "18px",
            }}
          >
              HACKATHON WEB PLATFORM
          </div>

          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "42px",
              lineHeight: 1.14,
              fontWeight: 900,
              maxWidth: "640px",
              letterSpacing: "-0.03em",
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

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginTop: "24px",
            }}
          >
            <Link
              href="/hackathons"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 20px",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#111827",
                fontWeight: 800,
                boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
              }}
            >
              해커톤 탐색하기
            </Link>

            <Link
              href="/camp"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px 20px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.24)",
                color: "#ffffff",
                fontWeight: 800,
                background: "rgba(255,255,255,0.08)",
              }}
            >
              팀 찾기
            </Link>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                borderRadius: "18px",
                padding: "14px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                전체 해커톤
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900 }}>{hackathons.length}</div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "14px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                모집 중인 팀
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900 }}>
                {teams.filter((team) => team.isOpen).length}
              </div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "14px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                리더보드
              </div>
              <div style={{ fontSize: "24px", fontWeight: 900 }}>{allBoards.length}</div>
            </div>
          </div>
        </div>
      </section>


      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.25fr 0.95fr",
          gap: "20px",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "28px",
            padding: "28px",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div style={{ marginBottom: "18px" }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "#2563eb",
                letterSpacing: "0.04em",
                marginBottom: "8px",
              }}
            >
              RECENT HACKATHONS
            </div>
            <h2 style={{ margin: 0, fontSize: "28px", fontWeight: 900 }}>
              최근 해커톤
            </h2>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {recentHackathons.map((hackathon) => (
              <Link key={hackathon.slug} href={`/hackathons/${hackathon.slug}`}>
                <article
                  style={{
                    border: "1px solid #edf0f5",
                    background: "#fbfcfe",
                    borderRadius: "20px",
                    padding: "20px",
                  }}
                >
                  <div style={{ marginBottom: "10px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "7px 11px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 800,
                        ...getStatusStyle(hackathon.status),
                      }}
                    >
                      {getStatusLabel(hackathon.status)}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "0 0 12px",
                      fontSize: "22px",
                      lineHeight: 1.35,
                      fontWeight: 900,
                    }}
                  >
                    {hackathon.title}
                  </h3>

                  <p style={{ margin: "0 0 8px", color: "#6b7280" }}>
                    제출 마감 · {formatDate(hackathon.period.submissionDeadlineAt)}
                  </p>
                  <p style={{ margin: 0, color: "#6b7280" }}>
                    종료일 · {formatDate(hackathon.period.endAt)}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginTop: "14px",
                    }}
                  >
                    {hackathon.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-block",
                          padding: "7px 11px",
                          borderRadius: "999px",
                          background: "#eef4ff",
                          color: "#2457c5",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: "20px" }}>
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "28px",
              padding: "24px",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "#2563eb",
                letterSpacing: "0.04em",
                marginBottom: "8px",
              }}
            >
              OPEN TEAMS
            </div>
            <h2 style={{ margin: "0 0 18px", fontSize: "28px", fontWeight: 900 }}>
              모집 중인 팀
            </h2>

            <div style={{ display: "grid", gap: "12px" }}>
              {openTeams.map((team) => (
                <Link key={team.teamCode} href={`/camp?hackathon=${team.hackathonSlug}`}>
                  <article
                    style={{
                      borderRadius: "18px",
                      padding: "18px",
                      background: "#fbfcfe",
                      border: "1px solid #edf0f5",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "10px",
                        marginBottom: "8px",
                        alignItems: "flex-start",
                      }}
                    >
                      <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900 }}>
                        {team.name}
                      </h3>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          background: "#e8f7ea",
                          color: "#1f7a35",
                          fontSize: "12px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        모집 중
                      </span>
                    </div>

                    <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>
                      {getHackathonTitle(team.hackathonSlug)}
                    </p>

                    <p style={{ margin: 0, color: "#374151", lineHeight: 1.6 }}>
                      {team.intro}
                    </p>
                  </article>
                </Link>
              ))}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: "28px",
              padding: "24px",
              boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: "#2563eb",
                letterSpacing: "0.04em",
                marginBottom: "8px",
              }}
            >
              TOP RANKING
            </div>
            <h2 style={{ margin: "0 0 18px", fontSize: "28px", fontWeight: 900 }}>
              상위 팀 미리보기
            </h2>

            <div style={{ display: "grid", gap: "12px" }}>
              {topTeams.map((item) => (
                <Link key={item.hackathonSlug} href="/rankings">
                  <article
                    style={{
                      borderRadius: "18px",
                      padding: "18px",
                      background: "#fbfcfe",
                      border: "1px solid #edf0f5",
                    }}
                  >
                    <p style={{ margin: "0 0 8px", color: "#2563eb", fontWeight: 800 }}>
                      {getHackathonTitle(item.hackathonSlug)}
                    </p>
                    <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 900 }}>
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