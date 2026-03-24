"use client";

import Link from "next/link";
import initialTeams from "../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../lib/local-auth";
import StatePanel from "./ui/StatePanel";
import {
  DIRECT_MESSAGES_CHANGED_EVENT,
  listDirectMessageThreadSummaries,
  type DirectMessageThreadSummary,
} from "../lib/direct-messages";

type Team = {
  teamCode: string;
  name: string;
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

type TabKey = "receivedRequests" | "sentRequests";

const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
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

function compareRequests(a: TeamJoinRequest, b: TeamJoinRequest) {
  if (a.status === "pending" && b.status !== "pending") return -1;
  if (a.status !== "pending" && b.status === "pending") return 1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function decodeEscapedUnicode(value: string | null | undefined) {
  if (!value) return "";
  return String(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function isBrokenSystemText(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return !normalized || normalized === "?" || normalized === "??" || normalized === "???" || normalized.includes("?");
}

function sanitizeNickname(value: string | null | undefined) {
  const decoded = decodeEscapedUnicode(value);
  return isBrokenSystemText(decoded) ? "멤버" : decoded.trim();
}

function sanitizeRole(value: string | null | undefined) {
  const decoded = decodeEscapedUnicode(value);
  return isBrokenSystemText(decoded) ? "" : decoded.trim();
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

function readTeams() {
  if (typeof window === "undefined") return initialTeams as Team[];

  try {
    const raw = window.localStorage.getItem("teams");
    if (!raw) return initialTeams as Team[];
    const parsed = JSON.parse(raw) as Team[];
    return Array.isArray(parsed) ? parsed : (initialTeams as Team[]);
  } catch {
    return initialTeams as Team[];
  }
}

function normalizeUserId(value: string | null | undefined) {
  return (value ?? "").trim();
}

function readJoinRequests() {
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

export default function FloatingMessageHub() {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("receivedRequests");
  const [selectedRequest, setSelectedRequest] = useState<{ item: TeamJoinRequest; ownerView: boolean } | null>(null);
  const [hubReady, setHubReady] = useState(false);
  const [hubError, setHubError] = useState("");
  const [teamsByCode, setTeamsByCode] = useState<Record<string, string>>({});
  const [receivedRequests, setReceivedRequests] = useState<TeamJoinRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<TeamJoinRequest[]>([]);
  const [recentThreads, setRecentThreads] = useState<DirectMessageThreadSummary[]>([]);

  useEffect(() => {
    function syncHub() {
      try {
        setHubError("");
        const session = getCurrentSession();
        const nextUserId = normalizeUserId(session?.userId);
        setUserId(nextUserId);

        if (!nextUserId) {
          setTeamsByCode({});
          setReceivedRequests([]);
          setSentRequests([]);
          setRecentThreads([]);
          setOpen(false);
          setSelectedRequest(null);
          setHubReady(true);
          return;
        }

        const teams = readTeams();
        const teamsMap = teams.reduce<Record<string, string>>((acc, team) => {
          acc[team.teamCode] = team.name;
          return acc;
        }, {});
        const teamOwners = getTeamOwners();
        const myTeamCodes = teams.filter((team) => teamOwners[team.teamCode] === nextUserId).map((team) => team.teamCode);
        const allRequests = readJoinRequests();

        setTeamsByCode(teamsMap);
        setReceivedRequests(allRequests.filter((request) => myTeamCodes.includes(request.teamCode)).sort(compareRequests));
        setSentRequests(allRequests.filter((request) => request.requesterId === nextUserId).sort(compareRequests));
        setRecentThreads(listDirectMessageThreadSummaries(nextUserId).slice(0, 3));
        setHubReady(true);
      } catch {
        setHubError("MSG 허브를 불러오는 중 문제가 발생했습니다.");
        setHubReady(true);
      }
    }

    syncHub();
    window.addEventListener(AUTH_CHANGED_EVENT, syncHub);
    window.addEventListener(MESSAGE_HUB_CHANGED_EVENT, syncHub);
    window.addEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncHub);
    window.addEventListener("storage", syncHub);
    window.addEventListener("focus", syncHub);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncHub);
      window.removeEventListener(MESSAGE_HUB_CHANGED_EVENT, syncHub);
      window.removeEventListener(DIRECT_MESSAGES_CHANGED_EVENT, syncHub);
      window.removeEventListener("storage", syncHub);
      window.removeEventListener("focus", syncHub);
    };
  }, []);

  const groupedReceivedRequests = useMemo(() => {
    return receivedRequests.reduce<Record<string, TeamJoinRequest[]>>((acc, item) => {
      (acc[item.teamCode] ??= []).push(item);
      return acc;
    }, {});
  }, [receivedRequests]);

  const groupedSentRequests = useMemo(() => {
    return sentRequests.reduce<Record<string, TeamJoinRequest[]>>((acc, item) => {
      (acc[item.teamCode] ??= []).push(item);
      return acc;
    }, {});
  }, [sentRequests]);

  if (!userId) {
    return null;
  }

  const pendingReceivedRequestCount = receivedRequests.filter((request) => request.status === "pending").length;
  const unreadMessageCount = recentThreads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  const hubBadgeCount = pendingReceivedRequestCount + unreadMessageCount;

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
          if (request.teamCode === item.teamCode && request.requesterId === item.requesterId && request.createdAt === item.createdAt) {
            changed = true;
            return { ...request, status: nextStatus, respondedAt };
          }
          return request;
        });

        if (!changed) continue;

        window.localStorage.setItem(key, JSON.stringify(nextRequests));
        window.dispatchEvent(new Event(MESSAGE_HUB_CHANGED_EVENT));

        setReceivedRequests((current) =>
          current.map((request) =>
            request.teamCode === item.teamCode && request.requesterId === item.requesterId && request.createdAt === item.createdAt
              ? { ...request, status: nextStatus, respondedAt }
              : request
          )
        );
        setSelectedRequest((current) =>
          current && current.item.teamCode === item.teamCode && current.item.requesterId === item.requesterId && current.item.createdAt === item.createdAt
            ? { ...current, item: { ...current.item, status: nextStatus, respondedAt } }
            : current
        );
        break;
      } catch {
        continue;
      }
    }
  }

  function renderRequestGroups(groups: Record<string, TeamJoinRequest[]>, emptyText: string, ownerView: boolean) {
    if (!hubReady) {
      return <StatePanel kind="loading" compact title="목록을 불러오는 중입니다" description="잠시만 기다려 주세요." />;
    }

    if (hubError) {
      return <StatePanel kind="error" compact title={hubError} description="다시 시도해 주세요." />;
    }

    const entries = Object.entries(groups);
    if (entries.length === 0) {
      return <StatePanel kind="empty" compact title={emptyText} />;
    }

    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {entries.map(([teamCode, items]) => (
          <div key={teamCode} style={{ display: "grid", gap: "10px" }}>
            <div style={{ fontWeight: 900, color: "#111827" }}>{teamsByCode[teamCode] || teamCode}</div>
            {items.map((item) => {
              const badge = getStatusBadge(item.status);
              const roleText = sanitizeRole(item.role);
              return (
                <div key={`${item.teamCode}-${item.requesterId}-${item.createdAt}`} className="interactive-card" style={{ borderColor: item.status === "pending" ? "#bfdbfe" : undefined }}>
                  <div style={{ padding: "12px", display: "grid", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: "#111827" }}>{ownerView ? sanitizeNickname(item.requesterName || item.requesterId) : teamsByCode[item.teamCode] || item.teamCode}</div>
                        <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>{roleText ? `지원 포지션 ${roleText}` : "지원 포지션 미입력"}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                        <button type="button" onClick={() => setSelectedRequest({ item, ownerView })} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>
                          상세 보기
                        </button>
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "13px" }}>{`생성일 ${formatDate(item.createdAt)}`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {open ? (
        <button type="button" onClick={() => setOpen(false)} aria-label="허브 닫기" style={{ position: "fixed", inset: 0, border: "none", background: "rgba(15, 23, 42, 0.18)", padding: 0, margin: 0, zIndex: 69, cursor: "pointer" }} />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="MSG 허브 열기"
        style={{ position: "fixed", right: "20px", bottom: "20px", width: "60px", height: "60px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#ffffff", fontWeight: 900, fontSize: "14px", boxShadow: "0 18px 40px rgba(37, 99, 235, 0.35)", cursor: "pointer", zIndex: 70 }}
      >
        MSG
        {hubBadgeCount > 0 ? (
          <span style={{ position: "absolute", top: "-2px", right: "-2px", minWidth: "24px", height: "24px", padding: "0 6px", borderRadius: "999px", background: "#ef4444", color: "#ffffff", fontWeight: 900, fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 24px rgba(239, 68, 68, 0.35)" }}>
            {hubBadgeCount > 99 ? "99+" : hubBadgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div style={{ position: "fixed", right: "20px", bottom: "92px", width: "min(400px, calc(100vw - 24px))", maxHeight: "min(70vh, 680px)", overflow: "hidden", borderRadius: "24px", background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", zIndex: 70, display: "grid", gridTemplateRows: "auto auto 1fr auto" }}>
          <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid #eef2f7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800 }}>MSG</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>요청과 알림</div>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <Link href="/messages" className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>쪽지함</Link>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>닫기</button>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", padding: "12px 18px", borderBottom: "1px solid #eef2f7", flexWrap: "wrap" }}>
            {[
              { key: "receivedRequests", label: "받은 요청", count: receivedRequests.length },
              { key: "sentRequests", label: "보낸 요청", count: sentRequests.length },
            ].map((tab) => (
              <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key as TabKey)} className="btn btn-secondary" style={{ minHeight: "36px", paddingInline: "12px", borderColor: activeTab === tab.key ? "#2563eb" : undefined, color: activeTab === tab.key ? "#1d4ed8" : undefined, background: activeTab === tab.key ? "#dbeafe" : undefined }}>
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div style={{ overflow: "auto", padding: "18px", display: "grid", gap: "18px" }}>
            {activeTab === "receivedRequests" ? renderRequestGroups(groupedReceivedRequests, "아직 받은 요청이 없습니다.", true) : null}
            {activeTab === "sentRequests" ? renderRequestGroups(groupedSentRequests, "아직 보낸 요청이 없습니다.", false) : null}

            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                <div style={{ fontWeight: 900, color: "#111827" }}>최근 대화</div>
                <Link href="/messages" className="subtle-link">전체 보기</Link>
              </div>
              {!hubReady ? (
                <StatePanel kind="loading" compact title="대화를 불러오는 중입니다" description="잠시만 기다려 주세요." />
              ) : hubError ? (
                <StatePanel kind="error" compact title={hubError} description="다시 시도해 주세요." />
              ) : recentThreads.length === 0 ? (
                <StatePanel kind="empty" compact title="아직 최근 대화가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: "10px" }}>
                  {recentThreads.map((summary) => (
                    <Link key={summary.thread.id} href={`/messages/${summary.thread.id}`} className="interactive-card" style={{ textDecoration: "none", color: "inherit" }}>
                      <article style={{ padding: "12px", display: "grid", gap: "6px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 800, color: "#111827" }}>{summary.otherNickname}</div>
                            <div style={{ color: "#6b7280", fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {summary.lastMessage ? summary.lastMessage.body : "아직 주고받은 쪽지가 없습니다."}
                            </div>
                          </div>
                          <div style={{ display: "grid", gap: "6px", justifyItems: "end" }}>
                            {summary.unreadCount > 0 ? <span className="status-chip status-chip--pending">읽지 않음 {summary.unreadCount}</span> : null}
                            <span className="muted" style={{ fontSize: "12px" }}>{summary.lastMessage ? formatDate(summary.lastMessage.createdAt) : formatDate(summary.thread.updatedAt)}</span>
                          </div>
                        </div>
                      </article>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <Overlay ariaLabel="요청 상세 닫기" onClose={() => setSelectedRequest(null)}>
          <div style={{ position: "fixed", right: "20px", bottom: "92px", width: "min(420px, calc(100vw - 24px))", borderRadius: "24px", background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)", zIndex: 72, padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "start", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800, marginBottom: "6px" }}>요청 상세</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>{teamsByCode[selectedRequest.item.teamCode] || selectedRequest.item.teamCode}</div>
              </div>
              <button type="button" onClick={() => setSelectedRequest(null)} className="btn btn-secondary" style={{ minHeight: "34px", paddingInline: "12px" }}>닫기</button>
            </div>

            {(() => {
              const badge = getStatusBadge(selectedRequest.item.status);
              const roleText = sanitizeRole(selectedRequest.item.role);
              return (
                <>
                  <div style={{ display: "grid", gap: "8px", marginBottom: "16px", color: "#4b5563", fontSize: "14px" }}>
                    <div>
                      상태
                      <span style={{ display: "inline-block", marginLeft: "8px", padding: "4px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>{badge.label}</span>
                    </div>
                    <div>{selectedRequest.ownerView ? `요청자 ${sanitizeNickname(selectedRequest.item.requesterName || selectedRequest.item.requesterId)}` : `팀 ${teamsByCode[selectedRequest.item.teamCode] || selectedRequest.item.teamCode}`}</div>
                    <div>{`지원 포지션 ${roleText || "미입력"}`}</div>
                    <div>{`생성 시각 ${formatDate(selectedRequest.item.createdAt)}`}</div>
                    {selectedRequest.item.respondedAt ? <div>{`처리 시각 ${formatDate(selectedRequest.item.respondedAt)}`}</div> : null}
                  </div>

                  {selectedRequest.item.message?.trim() ? (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>지원 메시지</div>
                      <div style={{ borderRadius: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px", color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selectedRequest.item.message}</div>
                    </div>
                  ) : null}

                  {selectedRequest.item.portfolioUrl?.trim() ? (
                    <div style={{ marginBottom: "16px" }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#6b7280", marginBottom: "6px" }}>포트폴리오 또는 GitHub</div>
                      <a href={selectedRequest.item.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 800, wordBreak: "break-all" }}>{selectedRequest.item.portfolioUrl}</a>
                    </div>
                  ) : null}

                  {selectedRequest.ownerView && selectedRequest.item.status === "pending" ? (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => updateJoinRequestStatus(selectedRequest.item, "rejected")} className="btn btn-secondary">거절</button>
                      <button type="button" onClick={() => updateJoinRequestStatus(selectedRequest.item, "accepted")} className="btn btn-primary">수락</button>
                    </div>
                  ) : null}
                </>
              );
            })()}
          </div>
        </Overlay>
      ) : null}
    </>
  );
}
