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
  savedSubmissions: number;
};

type DashboardLists = {
  myTeams: Team[];
  sentRequests: TeamJoinRequest[];
  receivedRequests: TeamJoinRequest[];
  savedSubmissions: SubmissionListItem[];
};

type PanelKey = "myTeams" | "receivedRequests" | "sentRequests" | "savedSubmissions";

const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
const TEAM_MESSAGES_STORAGE_KEY = "team-messages-v1";
const SUBMISSION_STORAGE_PREFIX = "hackathon-submissions-v1:";
const MESSAGE_HUB_CHANGED_EVENT = "message-hub-changed";

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

function decodeEscapedUnicode(value: string | null | undefined) {
  if (typeof value !== "string") return "";
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).trim();
}

function sanitizeNickname(value: string | null | undefined) {
  const decoded = decodeEscapedUnicode(value);
  return isBrokenSystemText(decoded) ? "멤버" : decoded;
}

function sanitizeRole(value: string | null | undefined) {
  const decoded = decodeEscapedUnicode(value);
  return isBrokenSystemText(decoded) ? "" : decoded;
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

function findTeamByCode(teams: Team[], teamCode: string) {
  return teams.find((team) => team.teamCode === teamCode) ?? null;
}

function getHackathonMembership(
  teams: Team[],
  teamOwners: Record<string, string>,
  requests: TeamJoinRequest[],
  userId: string,
  hackathonSlug: string
) {
  const normalizedUserId = userId.trim();
  const normalizedSlug = hackathonSlug.trim();
  if (!normalizedUserId || !normalizedSlug) return null;

  const ownedTeam = teams.find(
    (team) => team.hackathonSlug === normalizedSlug && teamOwners[team.teamCode] === normalizedUserId
  );
  if (ownedTeam) {
    return { kind: "owner" as const, teamCode: ownedTeam.teamCode };
  }

  const acceptedRequest = requests.find((request) => {
    if (request.requesterId !== normalizedUserId || request.status !== "accepted") return false;
    const targetTeam = findTeamByCode(teams, request.teamCode);
    return !!targetTeam && targetTeam.hackathonSlug === normalizedSlug;
  });

  if (acceptedRequest) {
    return { kind: "member" as const, teamCode: acceptedRequest.teamCode };
  }

  return null;
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

function Overlay({ children, onClose, ariaLabel }: { children: React.ReactNode; onClose: () => void; ariaLabel: string }) {
  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          border: "none",
          background: "rgba(15, 23, 42, 0.22)",
          padding: 0,
          margin: 0,
          zIndex: 71,
          cursor: "pointer",
        }}
      />
      {children}
    </>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: number;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="interactive-card"
      onClick={onClick}
      style={{
        textAlign: "left",
        cursor: "pointer",
        padding: 0,
        borderColor: active ? "#bfd3ff" : undefined,
        boxShadow: active ? "0 12px 26px rgba(15, 23, 42, 0.08)" : undefined,
      }}
    >
      <div style={{ padding: "16px", display: "grid", gap: "6px" }}>
        <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: "28px", lineHeight: 1, fontWeight: 800, color: "#111827" }}>{value}</div>
        <div className="muted" style={{ margin: 0 }}>{hint}</div>
      </div>
    </button>
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
  const [activePanel, setActivePanel] = useState<PanelKey>("myTeams");
  const [summary, setSummary] = useState<Summary>({
    myTeams: 0,
    sentRequests: 0,
    receivedRequests: 0,
    savedSubmissions: 0,
  });
  const [lists, setLists] = useState<DashboardLists>({
    myTeams: [],
    sentRequests: [],
    receivedRequests: [],
    savedSubmissions: [],
  });
  const [teamsByCode, setTeamsByCode] = useState<Record<string, string>>({});
  const [selectedRequest, setSelectedRequest] = useState<TeamJoinRequest | null>(null);

  useEffect(() => {
    function syncDashboard() {
      try {
        setError("");
        const session = getCurrentSession();
        const nextUserId = session?.userId ?? "";
        setNickname(session?.nickname ?? "");
        setUserId(nextUserId);

        if (!nextUserId) {
          setSummary({ myTeams: 0, sentRequests: 0, receivedRequests: 0, savedSubmissions: 0 });
          setLists({ myTeams: [], sentRequests: [], receivedRequests: [], savedSubmissions: [] });
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
        readStoredMessages();
        const sentRequests = joinRequests.filter((request) => request.requesterId === nextUserId).sort(compareRequests);
        const receivedRequests = joinRequests.filter((request) => myTeamCodes.includes(request.teamCode)).sort(compareRequests);
        const savedSubmissions = readSavedSubmissionsForUser(nextUserId);

        setTeamsByCode(nextTeamsByCode);
        setSummary({
          myTeams: myTeams.length,
          sentRequests: sentRequests.length,
          receivedRequests: receivedRequests.length,
          savedSubmissions: savedSubmissions.length,
        });
        setLists({ myTeams, sentRequests, receivedRequests, savedSubmissions });
        setReady(true);
      } catch {
        setError("대시보드를 불러오는 중 문제가 발생했습니다.");
        setReady(true);
      }
    }

    syncDashboard();
    window.addEventListener(AUTH_CHANGED_EVENT, syncDashboard);
    window.addEventListener(MESSAGE_HUB_CHANGED_EVENT, syncDashboard);
    window.addEventListener("storage", syncDashboard);
    window.addEventListener("focus", syncDashboard);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncDashboard);
      window.removeEventListener(MESSAGE_HUB_CHANGED_EVENT, syncDashboard);
      window.removeEventListener("storage", syncDashboard);
      window.removeEventListener("focus", syncDashboard);
    };
  }, []);

  const pendingSentRequests = lists.sentRequests.filter((request) => request.status === "pending").length;
  const pendingReceivedRequests = lists.receivedRequests.filter((request) => request.status === "pending").length;

  function updateJoinRequestStatus(item: TeamJoinRequest, nextStatus: "accepted" | "rejected") {
    if (typeof window === "undefined") return;

    const teams = readStoredTeams();
    const targetTeam = findTeamByCode(teams, item.teamCode);
    if (!targetTeam) return;

    const allRequests = readAllJoinRequests();
    const requesterMembership = getHackathonMembership(
      teams,
      getTeamOwners(),
      allRequests,
      item.requesterId,
      targetTeam.hackathonSlug
    );

    if (nextStatus === "accepted" && requesterMembership && requesterMembership.teamCode !== item.teamCode) {
      alert(
        requesterMembership.kind === "owner"
          ? "이 요청자는 이미 이 해커톤에서 다른 팀을 운영 중입니다."
          : "이 요청자는 이미 이 해커톤의 다른 팀에 소속되어 있습니다."
      );
      return;
    }

    const respondedAt = new Date().toISOString();

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

        let changed = false;
        const nextRequests = parsed.map((request) => {
          const requestTeam = findTeamByCode(teams, request.teamCode);
          const sameHackathon = !!requestTeam && requestTeam.hackathonSlug === targetTeam.hackathonSlug;
          const sameRequester = request.requesterId === item.requesterId;
          const isTarget =
            request.teamCode === item.teamCode && request.requesterId === item.requesterId && request.createdAt === item.createdAt;

          if (isTarget) {
            changed = true;
            return { ...request, status: nextStatus, respondedAt };
          }

          if (nextStatus === "accepted" && sameRequester && sameHackathon && request.status === "pending") {
            return { ...request, status: "rejected", respondedAt };
          }

          return request;
        });

        if (!changed) continue;

        window.localStorage.setItem(key, JSON.stringify(nextRequests));
        window.dispatchEvent(new Event(MESSAGE_HUB_CHANGED_EVENT));

        const nextSelected = { ...item, status: nextStatus, respondedAt };
        setLists((current) => ({
          ...current,
          receivedRequests: current.receivedRequests.map((request) =>
            request.teamCode === item.teamCode && request.requesterId === item.requesterId && request.createdAt === item.createdAt
              ? nextSelected
              : request
          ),
        }));
        setSelectedRequest((current) =>
          current && current.teamCode === item.teamCode && current.requesterId === item.requesterId && current.createdAt === item.createdAt
            ? nextSelected
            : current
        );
        break;
      } catch {
        continue;
      }
    }
  }

  if (!userId) {
    return (
      <main className="page-shell">
        <section className="section-card" style={{ display: "grid", gap: "14px" }}>
          <h1 className="section-title" style={{ margin: 0 }}>Dashboard를 보려면 Login이 필요합니다.</h1>
          <div>
            <Link href="/auth?mode=login&redirect=/dashboard" className="btn btn-secondary">
              Login 하러 가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  let detailTitle = "내 팀";
  let detailContent: React.ReactNode = null;

  if (activePanel === "myTeams") {
    detailTitle = "내 팀";
    detailContent = lists.myTeams.length === 0 ? (
      <StatePanel kind="empty" compact title="아직 만든 팀이 없습니다." />
    ) : (
      <div style={{ display: "grid", gap: "10px" }}>
        {lists.myTeams.map((team) => (
          <div key={team.teamCode} className="interactive-card">
            <article style={{ padding: "14px", display: "grid", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, color: "#111827" }}>{team.name}</div>
                {team.isOpen === undefined ? null : (
                  <span className={team.isOpen ? "status-chip status-chip--open" : "status-chip status-chip--closed"}>
                    {team.isOpen ? "모집중" : "모집 마감"}
                  </span>
                )}
              </div>
              {team.hackathonSlug ? <div className="muted">{getHackathonTitle(team.hackathonSlug)}</div> : null}
            </article>
          </div>
        ))}
      </div>
    );
  } else if (activePanel === "receivedRequests") {
    detailTitle = "받은 요청";
    detailContent = lists.receivedRequests.length === 0 ? (
      <StatePanel kind="empty" compact title="아직 받은 요청이 없습니다." />
    ) : (
      <div style={{ display: "grid", gap: "10px" }}>
        {lists.receivedRequests.map((request) => {
          const badge = getStatusBadge(request.status);
          const roleText = sanitizeRole(request.role);
          return (
            <div key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} className="interactive-card">
              <article style={{ padding: "14px", display: "grid", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                  <span style={{ display: "inline-flex", alignItems: "center", minHeight: "26px", padding: "0 9px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "11px" }}>{badge.label}</span>
                </div>
                <div style={{ color: "#475569", fontSize: "13px" }}>{sanitizeNickname(request.requesterName || request.requesterId)}</div>
                <div style={{ color: "#64748b", fontSize: "12px" }}>{roleText ? `지원 포지션 ${roleText}` : "지원 포지션 미입력"}</div>
                <div style={{ color: "#64748b", fontSize: "12px" }}>{`생성일 ${formatDate(request.createdAt)}`}</div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  <button type="button" onClick={() => setSelectedRequest(request)} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                    상세 보기
                  </button>
                  {request.status === "pending" ? (
                    <>
                      <button type="button" onClick={() => updateJoinRequestStatus(request, "rejected")} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                        거절
                      </button>
                      <button type="button" onClick={() => updateJoinRequestStatus(request, "accepted")} className="btn btn-primary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                        수락
                      </button>
                    </>
                  ) : null}
                </div>
              </article>
            </div>
          );
        })}
      </div>
    );
  } else if (activePanel === "sentRequests") {
    detailTitle = "보낸 요청";
    detailContent = lists.sentRequests.length === 0 ? (
      <StatePanel kind="empty" compact title="아직 보낸 요청이 없습니다." />
    ) : (
      <div style={{ display: "grid", gap: "10px" }}>
        {lists.sentRequests.map((request) => {
          const badge = getStatusBadge(request.status);
          const roleText = sanitizeRole(request.role);
          return (
            <div key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} className="interactive-card">
              <article style={{ padding: "14px", display: "grid", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                  <span style={{ display: "inline-flex", alignItems: "center", minHeight: "26px", padding: "0 9px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "11px" }}>{badge.label}</span>
                </div>
                <div style={{ color: "#64748b", fontSize: "12px" }}>{roleText ? `지원 포지션 ${roleText}` : "지원 포지션 미입력"}</div>
                <div style={{ color: "#64748b", fontSize: "12px" }}>{`생성일 ${formatDate(request.createdAt)}`}</div>
                {request.respondedAt ? <div style={{ color: "#64748b", fontSize: "12px" }}>{`처리일 ${formatDate(request.respondedAt)}`}</div> : null}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <button type="button" onClick={() => setSelectedRequest(request)} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                    상세 보기
                  </button>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    );
  } else {
    detailTitle = "저장한 제출";
    detailContent = lists.savedSubmissions.length === 0 ? (
      <StatePanel kind="empty" compact title="아직 저장한 제출이 없습니다." />
    ) : (
      <div style={{ display: "grid", gap: "10px" }}>
        {lists.savedSubmissions.map((item) => (
          <div key={item.record.id} className="interactive-card">
            <article style={{ padding: "14px", display: "grid", gap: "6px" }}>
              <div style={{ fontWeight: 800, color: "#111827" }}>{getHackathonTitle(item.record.hackathonSlug)}</div>
              <div style={{ color: "#64748b", fontSize: "12px" }}>{`저장일 ${formatDate(item.record.submittedAt)}`}</div>
              {item.record.notes ? <div style={{ color: "#374151", fontSize: "13px", lineHeight: 1.6 }}>{item.record.notes}</div> : null}
            </article>
          </div>
        ))}
      </div>
    );
  }

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="page-hero page-hero--dark" style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "grid", gap: "6px" }}>
            <div className="eyebrow">Dashboard</div>
            <h1 className="hero-title" style={{ margin: 0 }}>{`${nickname || "멤버"}님의 활동`}</h1>
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
              <SummaryCard label="내 팀" value={summary.myTeams} hint="참여 중인 팀" active={activePanel === "myTeams"} onClick={() => setActivePanel("myTeams")} />
              <SummaryCard label="받은 요청" value={summary.receivedRequests} hint={`대기중 ${pendingReceivedRequests}건`} active={activePanel === "receivedRequests"} onClick={() => setActivePanel("receivedRequests")} />
              <SummaryCard label="보낸 요청" value={summary.sentRequests} hint={`응답 대기 ${pendingSentRequests}건`} active={activePanel === "sentRequests"} onClick={() => setActivePanel("sentRequests")} />
              <SummaryCard label="저장한 제출" value={summary.savedSubmissions} hint="최근 저장 내역" active={activePanel === "savedSubmissions"} onClick={() => setActivePanel("savedSubmissions")} />
            </section>

            <SectionBlock title={detailTitle}>{detailContent}</SectionBlock>
          </>
        )}
      </div>

      {selectedRequest ? (
        <Overlay ariaLabel="요청 상세 닫기" onClose={() => setSelectedRequest(null)}>
          <div style={{ position: "fixed", right: "20px", bottom: "20px", width: "min(460px, calc(100vw - 24px))", borderRadius: "24px", background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", zIndex: 72, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800, marginBottom: "6px" }}>받은 요청 상세</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>{teamsByCode[selectedRequest.teamCode] || selectedRequest.teamCode}</div>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                닫기
              </button>
            </div>

            {(() => {
              const badge = getStatusBadge(selectedRequest.status);
              const roleText = sanitizeRole(selectedRequest.role);
              const requesterName = sanitizeNickname(selectedRequest.requesterName || selectedRequest.requesterId);

              return (
                <>
                  <div style={{ display: "grid", gap: "8px", marginBottom: "16px", color: "#4b5563", fontSize: "14px" }}>
                    <div>
                      상태
                      <span style={{ display: "inline-block", marginLeft: "8px", padding: "4px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                    </div>
                    <div>{`요청자 ${requesterName}`}</div>
                    <div>{`지원 포지션 ${roleText || "미입력"}`}</div>
                    <div>{`생성 시각 ${formatDate(selectedRequest.createdAt)}`}</div>
                    {selectedRequest.respondedAt ? <div>{`처리 시각 ${formatDate(selectedRequest.respondedAt)}`}</div> : null}
                  </div>

                  {selectedRequest.message?.trim() ? (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>지원 메시지</div>
                      <div style={{ borderRadius: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px", color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selectedRequest.message}</div>
                    </div>
                  ) : null}

                  {selectedRequest.portfolioUrl?.trim() ? (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>포트폴리오 또는 GitHub</div>
                      <a href={selectedRequest.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 800, wordBreak: "break-all" }}>{selectedRequest.portfolioUrl}</a>
                    </div>
                  ) : null}

                  {selectedRequest.status === "pending" ? (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => updateJoinRequestStatus(selectedRequest, "rejected")} className="btn btn-secondary">
                        거절
                      </button>
                      <button type="button" onClick={() => updateJoinRequestStatus(selectedRequest, "accepted")} className="btn btn-primary">
                        수락
                      </button>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </Overlay>
      ) : null}
    </main>
  );
}
