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
  name: string;
  createdAt?: string;
};

type TeamJoinRequest = {
  teamCode: string;
  requesterId: string;
  requesterName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  respondedAt?: string;
};

type SubmissionRecord = {
  id: string;
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
    if (!ownerUserId) continue;
    if (!isWithinPeriod(team.createdAt, period)) continue;

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
    <main style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto" }}>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "24px",
          padding: "28px",
          background: "#ffffff",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
          marginBottom: "24px",
        }}
      >
        <div style={{ marginBottom: "18px" }}>
          <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "10px" }}>글로벌 랭킹</h1>
          <p style={{ color: "#555", lineHeight: 1.7, margin: 0 }}>
            points는 팀 생성, Submit 저장, Accepted 된 참여 활동을 기준으로 계산됩니다.
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
          {[
            { key: "7d", label: "최근 7일" },
            { key: "30d", label: "최근 30일" },
            { key: "all", label: "전체" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key as PeriodKey)}
              style={{
                padding: "10px 14px",
                borderRadius: "12px",
                border: period === item.key ? "1px solid #2563eb" : "1px solid #d1d5db",
                background: period === item.key ? "#eff6ff" : "#ffffff",
                color: period === item.key ? "#2563eb" : "#374151",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {!rankingsReady ? (
          <StatePanel
            kind="loading"
            title="글로벌 랭킹을 불러오는 중입니다"
            description="잠시만 기다려 주세요."
          />
        ) : rankingsError ? (
          <StatePanel
            kind="error"
            title={rankingsError}
            description="다시 시도해 주세요."
          />
        ) : globalRanking.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "620px" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8fafc" }}>
                  <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>rank</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>닉네임</th>
                  <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>points</th>
                </tr>
              </thead>
              <tbody>
                {globalRanking.map((row) => (
                  <tr key={row.userId}>
                    <td style={{ borderBottom: "1px solid #eee", padding: "12px", fontWeight: "bold" }}>{row.rank}</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "12px" }}>
                      <div style={{ fontWeight: 800, color: "#111827", marginBottom: "4px" }}>{row.nickname}</div>
                      <div style={{ color: "#6b7280", fontSize: "13px" }}>
                        팀 생성 {row.teamCreates} / Submit {row.submissions} / Accepted {row.acceptedRequests}
                      </div>
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "12px", fontWeight: "bold" }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatePanel
            kind="empty"
            title="아직 집계할 활동이 없습니다"
            description="팀 생성, Submit 저장, 참여 요청 승인 활동이 생기면 랭킹에 반영됩니다."
          />
        )}
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          backgroundColor: "#fff",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "8px" }}>해커톤별 리더보드</h2>
          <p style={{ color: "#666", lineHeight: 1.6, margin: 0 }}>
            기존 해커톤별 팀 리더보드는 참고용으로 함께 제공합니다.
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
                <h3 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
                  {getHackathonTitle(board.hackathonSlug)}
                </h3>
                <p style={{ color: "#666" }}>마지막 업데이트: {formatDate(board.updatedAt)}</p>
              </div>

              {board.entries.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "800px" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f7f7f7" }}>
                        <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>순위</th>
                        <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>팀명</th>
                        <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>점수</th>
                        <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>제출 시각</th>
                        <th style={{ borderBottom: "1px solid #ddd", padding: "12px", textAlign: "left" }}>상세</th>
                      </tr>
                    </thead>

                    <tbody>
                      {board.entries.map((entry) => (
                        <tr key={`${board.hackathonSlug}-${entry.rank}-${entry.teamName}`}>
                          <td style={{ borderBottom: "1px solid #eee", padding: "12px", fontWeight: "bold" }}>{entry.rank}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: "12px" }}>{entry.teamName}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: "12px" }}>{entry.score}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: "12px" }}>{formatDate(entry.submittedAt)}</td>
                          <td style={{ borderBottom: "1px solid #eee", padding: "12px", lineHeight: 1.7 }}>
                            {entry.scoreBreakdown && (
                              <div style={{ marginBottom: "6px" }}>
                                <div>참가자 점수 {entry.scoreBreakdown.participant ?? "-"}</div>
                                <div>심사 점수 {entry.scoreBreakdown.judge ?? "-"}</div>
                              </div>
                            )}

                            {entry.artifacts?.planTitle && <div style={{ marginBottom: "4px" }}>기획안 {entry.artifacts.planTitle}</div>}
                            {entry.artifacts?.webUrl && (
                              <div>
                                <a href={entry.artifacts.webUrl} target="_blank" rel="noreferrer">
                                  웹 링크
                                </a>
                              </div>
                            )}
                            {entry.artifacts?.pdfUrl && (
                              <div>
                                <a href={entry.artifacts.pdfUrl} target="_blank" rel="noreferrer">
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
              ) : (
                <StatePanel
                  kind="empty"
                  compact
                  title="아직 공개된 리더보드가 없습니다"
                  description="이 해커톤의 순위 데이터가 준비되면 여기에 표시됩니다."
                />
              )}

              <div style={{ marginTop: "16px" }}>
                <Link href={`/hackathons/${board.hackathonSlug}`}>해당 해커톤 상세 보기</Link>
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
