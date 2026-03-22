import leaderboardData from "../../data/public_leaderboard.json";
import Link from "next/link";

type LeaderboardEntry = {
  rank: number;
  teamName: string;
  score: number;
  submittedAt: string;
  scoreBreakdown?: {
    participant?: number;
    judge?: number;
  };
  artifacts?: {
    webUrl?: string;
    pdfUrl?: string;
    planTitle?: string;
  };
};

type Leaderboard = {
  hackathonSlug: string;
  updatedAt: string;
  entries: LeaderboardEntry[];
};

type LeaderboardData = Leaderboard & {
  extraLeaderboards?: Leaderboard[];
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getHackathonTitle(slug: string) {
  switch (slug) {
    case "aimers-8-model-lite":
      return "Aimers 8";
    case "daker-handover-2026-03":
      return "Daker Handover 2026.03";
    default:
      return slug;
  }
}

export default function RankingsPage() {
  const data = leaderboardData as LeaderboardData;

  const allLeaderboards: Leaderboard[] = [
    {
      hackathonSlug: data.hackathonSlug,
      updatedAt: data.updatedAt,
      entries: data.entries,
    },
    ...(data.extraLeaderboards ?? []),
  ];

  return (
    <main style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "10px" }}>
          랭킹
        </h1>
        <p style={{ color: "#555", lineHeight: 1.6 }}>
          해커톤별 리더보드와 팀 점수를 확인할 수 있습니다.
        </p>
      </div>

      <div style={{ display: "grid", gap: "28px" }}>
        {allLeaderboards.map((board) => (
          <section
            key={board.hackathonSlug}
            style={{
              border: "1px solid #ddd",
              borderRadius: "16px",
              padding: "24px",
              backgroundColor: "#fff",
            }}
          >
            <div style={{ marginBottom: "18px" }}>
              <h2
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  marginBottom: "8px",
                }}
              >
                {getHackathonTitle(board.hackathonSlug)}
              </h2>
              <p style={{ color: "#666" }}>
                마지막 업데이트: {formatDate(board.updatedAt)}
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "800px",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f7f7f7" }}>
                    <th
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      순위
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      팀명
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      점수
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      제출 시간
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "12px",
                        textAlign: "left",
                      }}
                    >
                      상세
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {board.entries.map((entry) => (
                    <tr key={`${board.hackathonSlug}-${entry.rank}-${entry.teamName}`}>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "12px",
                          fontWeight: "bold",
                        }}
                      >
                        {entry.rank}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "12px",
                        }}
                      >
                        {entry.teamName}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "12px",
                        }}
                      >
                        {entry.score}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "12px",
                        }}
                      >
                        {formatDate(entry.submittedAt)}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "12px",
                          lineHeight: 1.7,
                        }}
                      >
                        {entry.scoreBreakdown && (
                          <div style={{ marginBottom: "6px" }}>
                            <div>참가자: {entry.scoreBreakdown.participant ?? "-"}</div>
                            <div>심사위원: {entry.scoreBreakdown.judge ?? "-"}</div>
                          </div>
                        )}

                        {entry.artifacts?.planTitle && (
                          <div style={{ marginBottom: "4px" }}>
                            기획서: {entry.artifacts.planTitle}
                          </div>
                        )}

                        {entry.artifacts?.webUrl && (
                          <div>
                            <a
                              href={entry.artifacts.webUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              웹 링크
                            </a>
                          </div>
                        )}

                        {entry.artifacts?.pdfUrl && (
                          <div>
                            <a
                              href={entry.artifacts.pdfUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              PDF 보기
                            </a>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "16px" }}>
              <Link href={`/hackathons/${board.hackathonSlug}`}>
                해당 해커톤 상세 보기
              </Link>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
