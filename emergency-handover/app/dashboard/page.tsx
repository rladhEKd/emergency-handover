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

type PanelKey = "myTeams" | "sentRequests" | "receivedRequests" | "sentMessages" | "savedSubmissions";

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
    return Array.isArray(parsed) ? parsed : [];
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
      if (Array.isArray(parsed)) {
        collected.push(...parsed);
      }
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

  return collected.sort(
    (a, b) => new Date(b.record.submittedAt).getTime() - new Date(a.record.submittedAt).getTime()
  );
}

function ToggleCard({
  label,
  value,
  hint,
  open,
  onToggle,
  children,
}: {
  label: string;
  value: number;
  hint?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: "20px",
        background: "#ffffff",
        border: open ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "22px",
          textAlign: "left",
          border: "none",
          background: open ? "#eff6ff" : "#ffffff",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "10px" }}>{label}</div>
            <div style={{ fontSize: "32px", fontWeight: 900, color: "#111827" }}>{value}</div>
            {hint ? <div style={{ fontSize: "13px", color: open ? "#2563eb" : "#6b7280", marginTop: "8px", fontWeight: 700 }}>{hint}</div> : null}
          </div>
          <div style={{ fontSize: "14px", fontWeight: 800, color: open ? "#2563eb" : "#6b7280" }}>
            {open ? "접기" : "상세 보기"}
          </div>
        </div>
      </button>
      {open ? <div style={{ padding: "0 22px 22px" }}>{children}</div> : null}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <StatePanel kind="empty" compact title={text} />;
}

export default function DashboardPage() {
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState("");
  const [dashboardReady, setDashboardReady] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
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
  const [openPanels, setOpenPanels] = useState<Record<PanelKey, boolean>>({
    myTeams: false,
    sentRequests: false,
    receivedRequests: false,
    sentMessages: false,
    savedSubmissions: false,
  });
  const [selectedRequest, setSelectedRequest] = useState<{ item: TeamJoinRequest; ownerView: boolean } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<TeamMessage | null>(null);

  useEffect(() => {
    function syncDashboard() {
      try {
        setDashboardError("");
        const session = getCurrentSession();
        const nextUserId = session?.userId ?? "";
        setNickname(session?.nickname ?? "");
        setUserId(nextUserId);

        if (!nextUserId) {
          setSummary({
            myTeams: 0,
            sentRequests: 0,
            receivedRequests: 0,
            sentMessages: 0,
            savedSubmissions: 0,
          });
          setLists({
            myTeams: [],
            sentRequests: [],
            receivedRequests: [],
            sentMessages: [],
            savedSubmissions: [],
          });
          setTeamsByCode({});
          setDashboardReady(true);
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
        const sentRequests = joinRequests
          .filter((request) => request.requesterId === nextUserId)
          .sort(compareRequests);
        const receivedRequests = joinRequests
          .filter((request) => myTeamCodes.includes(request.teamCode))
          .sort(compareRequests);
        const sentMessages = messages
          .filter((message) => message.senderUserId === nextUserId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const savedSubmissions = readSavedSubmissionsForUser(nextUserId);

        setTeamsByCode(nextTeamsByCode);
        setSummary({
          myTeams: myTeams.length,
          sentRequests: sentRequests.length,
          receivedRequests: receivedRequests.length,
          sentMessages: sentMessages.length,
          savedSubmissions: savedSubmissions.length,
        });
        setLists({
          myTeams,
          sentRequests,
          receivedRequests,
          sentMessages,
          savedSubmissions,
        });
        setDashboardReady(true);
      } catch {
        setDashboardError("대시보드 데이터를 불러오는 중 문제가 발생했습니다.");
        setDashboardReady(true);
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

  function togglePanel(key: PanelKey) {
    setOpenPanels((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function updateJoinRequestStatus(item: TeamJoinRequest, nextStatus: "accepted" | "rejected") {
    if (typeof window === "undefined") return;

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
          if (
            request.teamCode === item.teamCode &&
            request.requesterId === item.requesterId &&
            request.createdAt === item.createdAt
          ) {
            changed = true;
            return {
              ...request,
              status: nextStatus,
              respondedAt,
            };
          }

          return request;
        });

        if (!changed) {
          continue;
        }

        window.localStorage.setItem(key, JSON.stringify(nextRequests));
        setLists((current) => ({
          ...current,
          receivedRequests: current.receivedRequests.map((request) =>
            request.teamCode === item.teamCode &&
            request.requesterId === item.requesterId &&
            request.createdAt === item.createdAt
              ? { ...request, status: nextStatus, respondedAt }
              : request
          ),
        }));
        setSelectedRequest((current) =>
          current &&
          current.item.teamCode === item.teamCode &&
          current.item.requesterId === item.requesterId &&
          current.item.createdAt === item.createdAt
            ? {
                ...current,
                item: { ...current.item, status: nextStatus, respondedAt },
              }
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
      <main style={{ maxWidth: "980px", margin: "0 auto", padding: "32px 20px 72px" }}>
        <section
          style={{
            borderRadius: "28px",
            padding: "32px",
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
            color: "#ffffff",
            boxShadow: "0 24px 60px rgba(30, 58, 138, 0.22)",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "14px", opacity: 0.9 }}>MY DASHBOARD</div>
          <h1 style={{ margin: "0 0 12px", fontSize: "38px", fontWeight: 900 }}>Dashboard</h1>
          <p style={{ margin: 0, maxWidth: "560px", lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
            활동 요약을 보려면 Login이 필요합니다.
          </p>
          <div style={{ marginTop: "18px" }}>
            <Link
              href="/auth?mode=login&redirect=/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: "14px",
                background: "#ffffff",
                color: "#1d4ed8",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Login 하러 가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const pendingSentRequests = lists.sentRequests.filter((request) => request.status === "pending").length;
  const pendingReceivedRequests = lists.receivedRequests.filter((request) => request.status === "pending").length;
  const recentSentMessageTitles = lists.sentMessages.slice(0, 2).map((message) => message.title).filter(Boolean);

  return (
    <main style={{ maxWidth: "1120px", margin: "0 auto", padding: "32px 20px 72px" }}>
      <section
        style={{
          borderRadius: "28px",
          padding: "32px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
          color: "#ffffff",
          boxShadow: "0 24px 60px rgba(30, 58, 138, 0.22)",
          marginBottom: "24px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "14px", opacity: 0.9 }}>MY DASHBOARD</div>
        <h1 style={{ margin: "0 0 12px", fontSize: "38px", fontWeight: 900 }}>Dashboard</h1>
        <p style={{ margin: 0, maxWidth: "560px", lineHeight: 1.7, color: "rgba(255,255,255,0.9)" }}>
          현재 활동 요약을 확인해 보세요, {nickname || "member"}님.
        </p>
      </section>

      {!dashboardReady ? (
        <StatePanel
          kind="loading"
          title="대시보드 정보를 불러오는 중입니다"
          description="잠시만 기다려 주세요."
        />
      ) : dashboardError ? (
        <StatePanel
          kind="error"
          title={dashboardError}
          description="다시 시도해 주세요."
        />
      ) : (
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <ToggleCard
          label="내 팀"
          value={summary.myTeams}
          hint={summary.myTeams > 0 ? `${lists.myTeams.filter((team) => team.isOpen).length}개 팀이 모집중` : "팀 현황을 확인해 보세요"}
          open={openPanels.myTeams}
          onToggle={() => togglePanel("myTeams")}
        >
          {lists.myTeams.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {lists.myTeams.map((team) => (
                <article key={team.teamCode} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
                  <div style={{ fontWeight: 900, color: "#111827", marginBottom: "6px" }}>{team.name}</div>
                  <div style={{ color: "#6b7280", fontSize: "14px" }}>{getHackathonTitle(team.hackathonSlug)}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="아직 만든 팀이 없습니다." />
          )}
        </ToggleCard>

        <ToggleCard
          label="보낸 요청"
          value={summary.sentRequests}
          hint={pendingSentRequests > 0 ? `${pendingSentRequests}건 응답 대기중` : "최근 요청 상태를 확인해 보세요"}
          open={openPanels.sentRequests}
          onToggle={() => togglePanel("sentRequests")}
        >
          {lists.sentRequests.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {lists.sentRequests.map((request) => {
                const badge = getStatusBadge(request.status);

                return (
                  <article key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} style={{ borderRadius: "18px", background: request.status === "pending" ? "#f8fbff" : "#fbfcfe", border: request.status === "pending" ? "1px solid #bfdbfe" : "1px solid #edf0f5", boxShadow: request.status === "pending" ? "0 10px 24px rgba(37, 99, 235, 0.08)" : "none", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                        <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>{request.role?.trim() ? `지원 포지션 ${request.role}` : "지원 포지션 미입력"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedRequest({ item: request, ownerView: false })}
                          style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
                        >
                          상세 보기
                        </button>
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "14px" }}>생성일 {formatDate(request.createdAt)}</div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState text="아직 보낸 요청이 없습니다." />
          )}
        </ToggleCard>

        <ToggleCard
          label="받은 요청"
          value={summary.receivedRequests}
          hint={pendingReceivedRequests > 0 ? `${pendingReceivedRequests}건 대기중` : "처리가 필요한 요청을 확인해 보세요"}
          open={openPanels.receivedRequests}
          onToggle={() => togglePanel("receivedRequests")}
        >
          {lists.receivedRequests.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {lists.receivedRequests.map((request) => {
                const badge = getStatusBadge(request.status);

                return (
                  <article key={`${request.teamCode}-${request.requesterId}-${request.createdAt}`} style={{ borderRadius: "18px", background: request.status === "pending" ? "#f8fbff" : "#fbfcfe", border: request.status === "pending" ? "1px solid #bfdbfe" : "1px solid #edf0f5", boxShadow: request.status === "pending" ? "0 10px 24px rgba(37, 99, 235, 0.08)" : "none", padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 900, color: "#111827" }}>{teamsByCode[request.teamCode] || request.teamCode}</div>
                        <div style={{ color: "#6b7280", fontSize: "14px" }}>{request.requesterName || request.requesterId}</div>
                        <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>{request.role?.trim() ? `지원 포지션 ${request.role}` : "지원 포지션 미입력"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedRequest({ item: request, ownerView: true })}
                          style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
                        >
                          상세 보기
                        </button>
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "14px" }}>생성일 {formatDate(request.createdAt)}</div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState text="아직 받은 요청이 없습니다." />
          )}
        </ToggleCard>

        <ToggleCard
          label="보낸 쪽지"
          value={summary.sentMessages}
          hint={recentSentMessageTitles.length > 0 ? recentSentMessageTitles.join(" / ") : "최근 보낸 쪽지를 확인해 보세요"}
          open={openPanels.sentMessages}
          onToggle={() => togglePanel("sentMessages")}
        >
          {lists.sentMessages.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {lists.sentMessages.map((message) => (
                <article key={message.messageId} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
                    <div>
                      <div style={{ fontWeight: 900, color: "#111827" }}>{message.title}</div>
                      <div style={{ color: "#6b7280", fontSize: "14px" }}>{teamsByCode[message.teamCode] || message.teamCode}</div>
                      {message.receiverNickname ? <div style={{ color: "#374151", fontSize: "13px", marginTop: "6px" }}>받는 사람 {message.receiverNickname}</div> : null}
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontWeight: 800, fontSize: "12px" }}>전송 완료</span>
                      <button
                        type="button"
                        onClick={() => setSelectedMessage(message)}
                        style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}
                      >
                        상세 보기
                      </button>
                    </div>
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}>본문은 상세 보기에서 확인할 수 있습니다.</div>
                  <div style={{ color: "#6b7280", fontSize: "14px" }}>생성일 {formatDate(message.createdAt)}</div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="아직 보낸 쪽지가 없습니다." />
          )}
        </ToggleCard>

        <ToggleCard label="저장한 Submit" value={summary.savedSubmissions} open={openPanels.savedSubmissions} onToggle={() => togglePanel("savedSubmissions")}>
          {lists.savedSubmissions.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {lists.savedSubmissions.map((item) => (
                <article key={item.record.id} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
                  <div style={{ fontWeight: 900, color: "#111827", marginBottom: "6px" }}>{getHackathonTitle(item.record.hackathonSlug)}</div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}>저장일 {formatDate(item.record.submittedAt)}</div>
                  {item.record.notes ? (
                    <div style={{ color: "#374151", lineHeight: 1.7 }}>{item.record.notes}</div>
                  ) : (
                    <div style={{ color: "#6b7280", fontSize: "14px" }}>메모 없음</div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="아직 저장한 Submit이 없습니다." />
          )}
        </ToggleCard>
      </section>
      )}

      {selectedRequest ? (
        <>
          <button
            type="button"
            aria-label="요청 상세 닫기"
            onClick={() => setSelectedRequest(null)}
            style={{ position: "fixed", inset: 0, border: "none", background: "rgba(15, 23, 42, 0.22)", padding: 0, margin: 0, zIndex: 71, cursor: "pointer" }}
          />
          <div
            style={{
              position: "fixed",
              right: "20px",
              bottom: "20px",
              width: "min(440px, calc(100vw - 24px))",
              borderRadius: "24px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              zIndex: 72,
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800, marginBottom: "6px" }}>요청 상세</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>
                  {teamsByCode[selectedRequest.item.teamCode] || selectedRequest.item.teamCode}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                style={{ width: "36px", height: "36px", borderRadius: "999px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, cursor: "pointer" }}
              >
                X
              </button>
            </div>

            {(() => {
              const badge = getStatusBadge(selectedRequest.item.status);

              return (
                <>
                  <div style={{ display: "grid", gap: "8px", marginBottom: "16px", color: "#4b5563", fontSize: "14px" }}>
                    <div>
                      상태
                      <span style={{ display: "inline-block", marginLeft: "8px", padding: "4px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                    </div>
                    <div>{selectedRequest.ownerView ? `요청자 ${selectedRequest.item.requesterName || selectedRequest.item.requesterId}` : `대상 팀 ${teamsByCode[selectedRequest.item.teamCode] || selectedRequest.item.teamCode}`}</div>
                    <div>지원 포지션 {selectedRequest.item.role?.trim() || "미입력"}</div>
                    <div>생성 시각 {formatDate(selectedRequest.item.createdAt)}</div>
                    {selectedRequest.item.respondedAt ? <div>처리 시각 {formatDate(selectedRequest.item.respondedAt)}</div> : null}
                  </div>

                  {selectedRequest.item.message?.trim() ? (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>지원 메시지</div>
                      <div style={{ borderRadius: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px", color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                        {selectedRequest.item.message}
                      </div>
                    </div>
                  ) : null}

                  {selectedRequest.item.portfolioUrl?.trim() ? (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>포트폴리오 또는 GitHub</div>
                      <a href={selectedRequest.item.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 800, wordBreak: "break-all" }}>
                        {selectedRequest.item.portfolioUrl}
                      </a>
                    </div>
                  ) : null}

                  {selectedRequest.ownerView && selectedRequest.item.status === "pending" ? (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => updateJoinRequestStatus(selectedRequest.item, "rejected")}
                        style={{ padding: "10px 14px", borderRadius: "12px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, cursor: "pointer" }}
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        onClick={() => updateJoinRequestStatus(selectedRequest.item, "accepted")}
                        style={{ padding: "10px 14px", borderRadius: "12px", border: "none", background: "#2563eb", color: "#ffffff", fontWeight: 800, cursor: "pointer" }}
                      >
                        수락
                      </button>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </>
      ) : null}

      {selectedMessage ? (
        <>
          <button
            type="button"
            aria-label="쪽지 상세 닫기"
            onClick={() => setSelectedMessage(null)}
            style={{ position: "fixed", inset: 0, border: "none", background: "rgba(15, 23, 42, 0.22)", padding: 0, margin: 0, zIndex: 71, cursor: "pointer" }}
          />
          <div
            style={{
              position: "fixed",
              right: "20px",
              bottom: "20px",
              width: "min(440px, calc(100vw - 24px))",
              borderRadius: "24px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
              zIndex: 72,
              padding: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800, marginBottom: "6px" }}>쪽지 상세</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>{selectedMessage.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(null)}
                style={{ width: "36px", height: "36px", borderRadius: "999px", border: "1px solid #d1d5db", background: "#ffffff", color: "#374151", fontWeight: 800, cursor: "pointer" }}
              >
                X
              </button>
            </div>

            <div style={{ display: "grid", gap: "8px", marginBottom: "16px", color: "#4b5563", fontSize: "14px" }}>
              <div>팀 {teamsByCode[selectedMessage.teamCode] || selectedMessage.teamCode}</div>
              <div>보낸 사람 {selectedMessage.senderNickname}</div>
              {selectedMessage.receiverNickname ? <div>받는 사람 {selectedMessage.receiverNickname}</div> : null}
              <div>생성 시각 {formatDate(selectedMessage.createdAt)}</div>
            </div>

            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px", color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {selectedMessage.content}
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
