"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatePanel from "../../components/ui/StatePanel";
import leaderboardData from "../../data/public_leaderboard.json";
import { AUTH_CHANGED_EVENT } from "../../lib/local-auth";

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

type AuthUser = {
  id: string;
  nickname: string;
};

type Team = {
  teamCode: string;
  createdAt?: string;
};

type TeamJoinRequest = {
  requesterId: string;
  requesterName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  respondedAt?: string;
};

type SubmissionRecord = {
  submittedAt: string;
};

type GlobalRankingRow = {
  rank: number;
  userId: string;
  nickname: string;
  points: number;
  teamCreates: number;
  submissions: number;
  acceptedRequests: number;
};

type PeriodKey = "7d" | "30d" | "all";

const AUTH_USERS_KEY = "auth-users-v1";
const TEAM_OWNERS_KEY = "team-owners-v1";
const TEAMS_KEY = "teams";
const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
const SUBMISSION_STORAGE_PREFIX = "hackathon-submissions-v1:";

const POINTS = {
  teamCreate: 10,
  submissionSave: 30,
  acceptedJoin: 20,
} as const;

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
    case "monthly-vibe-coding-2026-02":
      return "Monthly Vibe Coding 2026.02";
    case "daker-handover-2026-03":
      return "Daker Handover 2026.03";
    default:
      return slug;
  }
}

function readJson<T>(key: string, fallback: T) {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

function readUsers() {
  const parsed = readJson<AuthUser[]>(AUTH_USERS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function readTeams() {
  const parsed = readJson<Team[]>(TEAMS_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function readTeamOwners() {
  const parsed = readJson<Record<string, string>>(TEAM_OWNERS_KEY, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function readAllJoinRequests() {
  const collected: TeamJoinRequest[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(TEAM_JOIN_REQUESTS_PREFIX)) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as TeamJoinRequest[];
    if (Array.isArray(parsed)) {
      collected.push(...parsed);
    }
  }

  return collected;
}

function readAllSubmissionEntries() {
  const collected: Array<{ userId: string; record: SubmissionRecord }> = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(SUBMISSION_STORAGE_PREFIX)) continue;

    const parts = key.split(":");
    const userId = parts[parts.length - 1] ?? "";
    if (!userId) continue;

    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as SubmissionRecord[];
    if (!Array.isArray(parsed)) continue;

    for (const record of parsed) {
      if (record?.submittedAt) {
        collected.push({ userId, record });
      }
    }
  }

  return collected;
}

function getPeriodStart(period: PeriodKey) {
  if (period === "all") return null;
  const now = Date.now();
  const days = period === "7d" ? 7 : 30;
  return now - days * 24 * 60 * 60 * 1000;
}

function isWithinPeriod(dateString: string | undefined, period: PeriodKey) {
  if (!dateString) return period === "all";
  const timestamp = new Date(dateString).getTime();
  if (Number.isNaN(timestamp)) return period === "all";
  const periodStart = getPeriodStart(period);
  if (periodStart === null) return true;
  return timestamp >= periodStart;
}

function buildGlobalRanking(period: PeriodKey) {
  const users = readUsers();
  const usersById = new Map(users.map((user) => [user.id, user.nickname]));
  const teams = readTeams();
  const teamOwners = readTeamOwners();
  const joinRequests = readAllJoinRequests();
  const submissions = readAllSubmissionEntries();

  const scoreMap = new Map<string, Omit<GlobalRankingRow, "rank">>();

  function ensureUser(userId: string, fallbackNickname?: string) {
    const normalizedId = userId.trim();
    if (!normalizedId) return null;

    const existing = scoreMap.get(normalizedId);
    if (existing) return existing;

    const next: Omit<GlobalRankingRow, "rank"> = {
      userId: normalizedId,
      nickname: usersById.get(normalizedId) || fallbackNickname || normalizedId,
      points: 0,
      teamCreates: 0,
      submissions: 0,
      acceptedRequests: 0,
    };

    scoreMap.set(normalizedId, next);
    return next;
  }

  for (const team of teams) {
    const ownerUserId = teamOwners[team.teamCode];
    if (!ownerUserId || !isWithinPeriod(team.createdAt, period)) continue;
    const row = ensureUser(ownerUserId);
    if (!row) continue;
    row.teamCreates += 1;
    row.points += POINTS.teamCreate;
  }

  for (const item of submissions) {
    if (!isWithinPeriod(item.record.submittedAt, period)) continue;
    const row = ensureUser(item.userId);
    if (!row) continue;
    row.submissions += 1;
    row.points += POINTS.submissionSave;
  }

  for (const request of joinRequests) {
    if (request.status !== "accepted") continue;
    const activityAt = request.respondedAt || request.createdAt;
    if (!isWithinPeriod(activityAt, period)) continue;
    const row = ensureUser(request.requesterId, request.requesterName);
    if (!row) continue;
    row.acceptedRequests += 1;
    row.points += POINTS.acceptedJoin;
  }

  return [...scoreMap.values()]
    .filter((item) => item.points > 0)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.submissions !== a.submissions) return b.submissions - a.submissions;
      if (b.acceptedRequests !== a.acceptedRequests) return b.acceptedRequests - a.acceptedRequests;
      return a.nickname.localeCompare(b.nickname, "ko");
    })
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));
}

export default function RankingsPage() {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [globalRanking, setGlobalRanking] = useState<GlobalRankingRow[]>([]);
  const [rankingsReady, setRankingsReady] = useState(false);
  const [rankingsError, setRankingsError] = useState("");

  const data = leaderboardData as LeaderboardData;
  const allLeaderboards: Leaderboard[] = useMemo(
    () => [
      {
        hackathonSlug: data.hackathonSlug,
        updatedAt: data.updatedAt,
        entries: data.entries,
      },
      ...(data.extraLeaderboards ?? []),
    ],
    [data]
  );

  useEffect(() => {
    function syncRankings() {
      try {
        setRankingsError("");
        setGlobalRanking(buildGlobalRanking(period));
        setRankingsReady(true);
      } catch {
        setRankingsError("랭킹 데이터를 불러오는 중 문제가 발생했습니다.");
        setGlobalRanking([]);
        setRankingsReady(true);
      }
    }

    syncRankings();
    window.addEventListener(AUTH_CHANGED_EVENT, syncRankings);
    window.addEventListener("storage", syncRankings);
    window.addEventListener("focus", syncRankings);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncRankings);
      window.removeEventListener("storage", syncRankings);
      window.removeEventListener("focus", syncRankings);
    };
  }, [period]);

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="page-hero page-hero--dark" style={{ padding: "22px" }}>
          <span className="eyebrow">Rankings</span>
          <h1 className="hero-title" style={{ marginTop: "10px", marginBottom: "10px" }}>
            랭킹
          </h1>
          <div className="hero-actions" style={{ marginTop: "8px" }}>
            {[
              { key: "7d", label: "최근 7일" },
              { key: "30d", label: "최근 30일" },
              { key: "all", label: "전체" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                className={`tab-button ${period === item.key ? "tab-button--active" : ""}`}
                onClick={() => setPeriod(item.key as PeriodKey)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="section-card">
          <div className="section-header" style={{ marginBottom: "14px" }}>
            <div>
              <h2 className="section-title">글로벌 랭킹</h2>
            </div>
          </div>

          {!rankingsReady ? (
            <StatePanel kind="loading" title="글로벌 랭킹을 불러오는 중입니다" description="잠시만 기다려 주세요." />
          ) : rankingsError ? (
            <StatePanel kind="error" title={rankingsError} description="다시 시도해 주세요." />
          ) : globalRanking.length > 0 ? (
            <div className="table-shell table-shell--scroll">
              <table className="k-table" style={{ minWidth: "640px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "88px" }}>순위</th>
                    <th>닉네임</th>
                    <th style={{ width: "132px", textAlign: "right" }}>점수</th>
                  </tr>
                </thead>
                <tbody>
                  {globalRanking.map((row) => (
                    <tr key={row.userId} style={row.rank <= 3 ? { background: "#f8fbff" } : undefined}>
                      <td>
                        <strong
                          style={{
                            color: row.rank <= 3 ? "#1d4ed8" : "#0f172a",
                            fontSize: row.rank <= 3 ? "18px" : "16px",
                            fontWeight: 800,
                          }}
                        >
                          {row.rank}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "6px" }}>{row.nickname}</div>
                        <div className="inline-actions" style={{ gap: "6px" }}>
                          <span className="chip">팀 {row.teamCreates}</span>
                          <span className="chip">Submit {row.submissions}</span>
                          <span className="chip">수락 {row.acceptedRequests}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontSize: row.rank <= 3 ? "22px" : "20px",
                            fontWeight: 800,
                            color: row.rank <= 3 ? "#1d4ed8" : "#0f172a",
                          }}
                        >
                          {row.points}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <StatePanel
              kind="empty"
              title="아직 집계할 활동이 없습니다"
              description="팀 생성, Submit 저장, 수락된 참여 활동이 있으면 점수에 반영됩니다."
            />
          )}
        </section>

        <section className="section-card">
          <div className="section-header" style={{ marginBottom: "14px" }}>
            <div>
              <h2 className="section-title">해커톤별 리더보드</h2>
            </div>
          </div>

          <div className="stack-md">
            {allLeaderboards.map((board) => (
              <section key={board.hackathonSlug} className="list-card" style={{ padding: "18px" }}>
                <div className="section-header" style={{ marginBottom: "12px" }}>
                  <div>
                    <h3 className="section-title" style={{ fontSize: "18px", margin: 0 }}>
                      {getHackathonTitle(board.hackathonSlug)}
                    </h3>
                    <div className="muted" style={{ marginTop: "6px", fontSize: "12px" }}>
                      업데이트 {formatDate(board.updatedAt)}
                    </div>
                  </div>
                  <Link href={`/hackathons/${board.hackathonSlug}`} className="btn btn-secondary">
                    상세 보기
                  </Link>
                </div>

                {board.entries.length > 0 ? (
                  <div className="table-shell table-shell--scroll">
                    <table className="k-table" style={{ minWidth: "760px" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "72px" }}>순위</th>
                          <th>팀명</th>
                          <th style={{ width: "120px", textAlign: "right" }}>점수</th>
                          <th style={{ width: "172px" }}>제출 시각</th>
                          <th>기록</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.entries.map((entry) => (
                          <tr key={`${board.hackathonSlug}-${entry.rank}-${entry.teamName}`}>
                            <td>
                              <strong style={{ fontSize: entry.rank <= 3 ? "17px" : "15px", color: entry.rank <= 3 ? "#1d4ed8" : "#0f172a" }}>
                                {entry.rank}
                              </strong>
                            </td>
                            <td>
                              <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>{entry.teamName}</div>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <strong style={{ fontSize: "18px", fontWeight: 800 }}>{entry.score}</strong>
                            </td>
                            <td>{formatDate(entry.submittedAt)}</td>
                            <td>
                              <div className="stack-sm" style={{ gap: "6px" }}>
                                {entry.scoreBreakdown ? (
                                  <div className="muted" style={{ fontSize: "12px" }}>
                                    참여 {entry.scoreBreakdown.participant ?? "-"} / 심사 {entry.scoreBreakdown.judge ?? "-"}
                                  </div>
                                ) : null}
                                {entry.artifacts?.planTitle ? <div style={{ fontSize: "13px", color: "#334155" }}>{entry.artifacts.planTitle}</div> : null}
                                <div className="inline-actions" style={{ gap: "8px" }}>
                                  {entry.artifacts?.webUrl ? (
                                    <a href={entry.artifacts.webUrl} target="_blank" rel="noreferrer" className="subtle-link">
                                      웹 링크
                                    </a>
                                  ) : null}
                                  {entry.artifacts?.pdfUrl ? (
                                    <a href={entry.artifacts.pdfUrl} target="_blank" rel="noreferrer" className="subtle-link">
                                      PDF 보기
                                    </a>
                                  ) : null}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <StatePanel
                    kind="empty"
                    compact
                    title="아직 공개 리더보드가 없습니다"
                    description="순위 데이터가 준비되면 여기에 표시됩니다."
                  />
                )}
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
