"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatePanel from "../../components/ui/StatePanel";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../../lib/local-auth";

type Team = {
  teamCode: string;
  name: string;
  hackathonSlug: string;
  isOpen?: boolean;
};

type TeamJoinRequest = {
  teamCode: string;
  requesterId: string;
  requesterName: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  respondedAt?: string;
  role?: string;
  message?: string;
  portfolioUrl?: string;
};

type TeamMessage = {
  messageId: string;
  teamCode: string;
  senderUserId: string;
  senderNickname: string;
  receiverUserId?: string;
  receiverNickname?: string;
  title: string;
  content: string;
  createdAt: string;
};

type SubmissionRecord = {
  id: string;
  hackathonSlug: string;
  submittedAt: string;
  notes: string;
  values: Record<string, string>;
};

type SubmissionListItem = {
  storageKey: string;
  record: SubmissionRecord;
};

type Summary = {
  myTeams: number;
  sentRequests: number;
  receivedRequests: number;
  sentMessages: number;
  savedSubmissions: number;
};

type DashboardLists = {
  myTeams: Team[];
  sentRequests: TeamJoinRequest[];
  receivedRequests: TeamJoinRequest[];
  sentMessages: TeamMessage[];
  savedSubmissions: SubmissionListItem[];
};

const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
const TEAM_MESSAGES_STORAGE_KEY = "team-messages-v1";
const SUBMISSION_STORAGE_PREFIX = "hackathon-submissions-v1:";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isBrokenSystemText(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return !normalized || normalized === "?" || normalized === "??" || normalized === "???" || normalized.includes("?");
}

function sanitizeNickname(value: string | null | undefined) {
  return isBrokenSystemText(value) ? "멤버" : String(value).trim();
}

function sanitizeRole(value: string | null | undefined) {
  return isBrokenSystemText(value) ? "" : String(value).trim();
}

function getStatusBadge(status: "pending" | "accepted" | "rejected") {
  if (status === "accepted") {
    return { label: "수락됨", background: "#e8f7ea", color: "#1e7a35" };
  }

  if (status === "rejected") {
    return { label: "거절됨", background: "#f3f4f6", color: "#4b5563" };
  }

  return { label: "대기중", background: "#eef4ff", color: "#2457c5" };
}

function compareRequests(a: TeamJoinRequest, b: TeamJoinRequest) {
  if (a.status === "pending" && b.status !== "pending") return -1;
  if (a.status !== "pending" && b.status === "pending") return 1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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

function readStoredTeams() {
  if (typeof window === "undefined") return [] as Team[];

  try {
    const raw = window.localStorage.getItem("teams");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Team[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStoredMessages() {
  if (typeof window === "undefined") return [] as TeamMessage[];

  try {
    const raw = window.localStorage.getItem(TEAM_MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeamMessage[];
    if (!Array.isArray(parsed)) return [];

    const nextMessages = parsed.map((message) => ({
      ...message,
      senderNickname: sanitizeNickname(message.senderNickname),
      receiverNickname: sanitizeNickname(message.receiverNickname),
    }));

    if (JSON.stringify(nextMessages) !== raw) {
      window.localStorage.setItem(TEAM_MESSAGES_STORAGE_KEY, JSON.stringify(nextMessages));
    }

    return nextMessages;
  } catch {
    return [];
  }
}

function readAllJoinRequests() {
  if (typeof window === "undefined") return [] as TeamJoinRequest[];

  const collected: TeamJoinRequest[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(TEAM_JOIN_REQUESTS_PREFIX)) {
      continue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as TeamJoinRequest[];
      if (!Array.isArray(parsed)) continue;

      const nextRequests = parsed.map((request) => ({
        ...request,
        requesterName: sanitizeNickname(request.requesterName),
        role: sanitizeRole(request.role),
      }));

      if (JSON.stringify(nextRequests) !== raw) {
        window.localStorage.setItem(key, JSON.stringify(nextRequests));
      }

      collected.push(...nextRequests);
    } catch {
      continue;
    }
  }

  return collected;
}

function readSavedSubmissionsForUser(userId: string) {
  if (typeof window === "undefined") return [] as SubmissionListItem[];

  const collected: SubmissionListItem[] = [];
  const suffix = `:${userId}`;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key || !key.startsWith(SUBMISSION_STORAGE_PREFIX) || !key.endsWith(suffix)) {
      continue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SubmissionRecord[];
      if (!Array.isArray(parsed)) continue;

      for (const record of parsed) {
        collected.push({ storageKey: key, record });
      }
    } catch {
      continue;
    }
  }

  return collected.sort((a, b) => new Date(b.record.submittedAt).getTime() - new Date(a.record.submittedAt).getTime());
}

function SummaryCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <section className="section-card" style={{ padding: "16px", display: "grid", gap: "6px" }}>
      <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: "28px", lineHeight: 1, fontWeight: 800, color: "#111827" }}>{value}</div>
      <div className="muted" style={{ margin: 0 }}>{hint}</div>
    </section>
  );
}

function SectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section-card" style={{ display: "grid", gap: "12px" }}>
      <h2 className="section-title" style={{ margin: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<Summary>({
    myTeams: 0,
    sentRequests: 0,
    receivedRequests: 0,
    sentMessages: 0,
    savedSubmissions: 0,
  });
  const [lists, setLists] = useState<DashboardLists>({
    myTeams: [],
    sentRequests: [],
    receivedRequests: [],
    sentMessages: [],
    savedSubmissions: [],
  });
  const [teamsByCode, setTeamsByCode] = useState<Record<string, string>>({});

  useEffect(() => {
    function syncDashboard() {
      try {
        setError("");
        const session = getCurrentSession();
        const nextUserId = session?.userId ?? "";
        setNickname(session?.nickname ?? "");
        setUserId(nextUserId);

        if (!nextUserId) {
          setSummary({ myTeams: 0, sentRequests: 0, receivedRequests: 0, sentMessages: 0, savedSubmissions: 0 });
          setLists({ myTeams: [], sentRequests: [], receivedRequests: [], sentMessages: [], savedSubmissions: [] });
          setTeamsByCode({});
          setReady(true);
          return;
        }

        const teams = readStoredTeams();
        const nextTeamsByCode = teams.reduce<Record<string, string>>((acc, team) => {
          acc[team.teamCode] = team.name;
          return acc;
        }, {});
        const teamOwners = getTeamOwners();
        const myTeams = teams.filter((team) => teamOwners[team.teamCode] === nextUserId);
        const myTeamCodes = myTeams.map((team) => team.teamCode);
        const joinRequests = readAllJoinRequests();
        const messages = readStoredMessages();
        const sentRequests = joinRequests.filter((request) => request.requesterId === nextUserId).sort(compareRequests);
        const receivedRequests = joinRequests.filter((request) => myTeamCodes.includes(request.teamCode)).sort(compareRequests);
        const sentMessages = messages.filter((message) => message.senderUserId === nextUserId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const savedSubmissions = readSavedSubmissionsForUser(nextUserId);

        setTeamsByCode(nextTeamsByCode);
        setSummary({
          myTeams: myTeams.length,
          sentRequests: sentRequests.length,
          receivedRequests: receivedRequests.length,
          sentMessages: sentMessages.length,
          savedSubmissions: savedSubmissions.length,
        });
        setLists({ myTeams, sentRequests, receivedRequests, sentMessages, savedSubmissions });
        setReady(true);
      } catch {
        setError("대시보드를 불러오는 중 문제가 발생했습니다.");
        setReady(true);
      }
    }

    syncDashboard();
    window.addEventListener(AUTH_CHANGED_EVENT, syncDashboard);
    window.addEventListener("storage", syncDashboard);
    window.addEventListener("focus", syncDashboard);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncDashboard);
      window.removeEventListener("storage", syncDashboard);
      window.removeEventListener("focus", syncDashboard);
    };
  }, []);

  const pendingSentRequests = lists.sentRequests.filter((request) => request.status === "pending").length;
  const pendingReceivedRequests = lists.receivedRequests.filter((request) => request.status === "pending").length;

  if (!userId) {
    return (
      <main className="page-shell">
        <section className="section-card" style={{ display: "grid", gap: "14px" }}>
          <h1 className="section-title" style={{ margin: 0 }}>{"Dashboard를 보려면 Login이 필요합니다"}</h1>
          <div>
            <Link href="/auth?mode=login&redirect=/dashboard" className="btn btn-secondary">
              Login 하러 가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="section-card" style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div className="eyebrow">Dashboard</div>
            <h1 className="section-title" style={{ margin: 0 }}>{`${nickname || "멤버"}님의 활동`}</h1>
          </div>
          <div className="hero-meta" style={{ marginTop: 0 }}>
            <span>{`대기중인 받은 요청 ${pendingReceivedRequests}건`}</span>
            <span>{`응답 대기 요청 ${pendingSentRequests}건`}</span>
            <span>{`저장한 제출 ${summary.savedSubmissions}건`}</span>
          </div>
          <div className="inline-actions">
            <Link href="/messages" className="btn btn-secondary">쪽지함</Link>
            <Link href="/camp" className="btn btn-secondary">팀 관리</Link>
            <Link href="/hackathons" className="btn btn-secondary">해커톤 보기</Link>
            <Link href="/rankings" className="btn btn-secondary">랭킹 보기</Link>
          </div>
        </section>

        {!ready ? (
          <StatePanel kind="loading" title="대시보드를 불러오는 중입니다" description="잠시만 기다려 주세요." />
        ) : error ? (
          <StatePanel kind="error" title={error} description="다시 시도해 주세요." />
        ) : (
          <>
            <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
              <SummaryCard label="내 팀" value={summary.myTeams} hint="참여 중인 팀을 확인할 수 있습니다." />
              <SummaryCard label="받은 요청" value={summary.receivedRequests} hint={`대기중 ${pendingReceivedRequests}건`} />
              <SummaryCard label="보낸 요청" value={summary.sentRequests} hint={`응답 대기 ${pendingSentRequests}건`} />
              <SummaryCard label="보낸 쪽지" value={summary.sentMessages} hint="최근 보낸 메시지를 확인할 수 있습니다." />
              <SummaryCard label="저장한 제출" value={summary.savedSubmissions} hint="제출한 항목과 메모를 다시 볼 수 있습니다." />
            </section>

            <SectionBlock title="받은 요청">
              {lists.receivedRequests.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 받은 요청이 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {lists.receivedRequests.map((request) => {
                    const badge = getStatusBadge(request.status);
                    const roleText = sanitizeRole(request.role);
                    return (
                      <article key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} style={{ borderRadius: "14px", border: "1px solid #edf0f5", background: "#fbfcfe", padding: "14px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                          <span style={{ display: "inline-flex", alignItems: "center", minHeight: "26px", padding: "0 9px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "11px" }}>{badge.label}</span>
                        </div>
                        <div style={{ color: "#475569", fontSize: "13px" }}>{sanitizeNickname(request.requesterName || request.requesterId)}</div>
                        <div style={{ color: "#64748b", fontSize: "12px" }}>{roleText ? `지원 포지션 ${roleText}` : "지원 포지션 미입력"}</div>
                        <div style={{ color: "#64748b", fontSize: "12px" }}>{`생성일 ${formatDate(request.createdAt)}`}</div>
                      </article>
                    );
                  })}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="보낸 요청">
              {lists.sentRequests.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 보낸 요청이 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {lists.sentRequests.map((request) => {
                    const badge = getStatusBadge(request.status);
                    const roleText = sanitizeRole(request.role);
                    return (
                      <article key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} style={{ borderRadius: "14px", border: "1px solid #edf0f5", background: "#fbfcfe", padding: "14px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ fontWeight: 800, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                          <span style={{ display: "inline-flex", alignItems: "center", minHeight: "26px", padding: "0 9px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "11px" }}>{badge.label}</span>
                        </div>
                        <div style={{ color: "#64748b", fontSize: "12px" }}>{roleText ? `지원 포지션 ${roleText}` : "지원 포지션 미입력"}</div>
                        <div style={{ color: "#64748b", fontSize: "12px" }}>{`생성일 ${formatDate(request.createdAt)}`}</div>
                      </article>
                    );
                  })}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="보낸 쪽지">
              {lists.sentMessages.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 보낸 쪽지가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {lists.sentMessages.map((message) => (
                    <article key={message.messageId} style={{ borderRadius: "14px", border: "1px solid #edf0f5", background: "#fbfcfe", padding: "14px", display: "grid", gap: "6px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{message.title}</div>
                      <div style={{ color: "#64748b", fontSize: "12px" }}>{teamsByCode[message.teamCode] || message.teamCode}</div>
                      <div style={{ color: "#64748b", fontSize: "12px" }}>{`생성일 ${formatDate(message.createdAt)}`}</div>
                    </article>
                  ))}
                </div>
              )}
            </SectionBlock>

            <SectionBlock title="저장한 제출">
              {lists.savedSubmissions.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 저장한 제출이 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {lists.savedSubmissions.map((item) => (
                    <article key={item.record.id} style={{ borderRadius: "14px", border: "1px solid #edf0f5", background: "#fbfcfe", padding: "14px", display: "grid", gap: "6px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{getHackathonTitle(item.record.hackathonSlug)}</div>
                      <div style={{ color: "#64748b", fontSize: "12px" }}>{`저장일 ${formatDate(item.record.submittedAt)}`}</div>
                      {item.record.notes ? <div style={{ color: "#374151", fontSize: "13px", lineHeight: 1.6 }}>{item.record.notes}</div> : null}
                    </article>
                  ))}
                </div>
              )}
            </SectionBlock>
          </>
        )}
      </div>
    </main>
  );
}
