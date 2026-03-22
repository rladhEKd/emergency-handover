"use client";

import initialTeams from "../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../lib/local-auth";
import StatePanel from "./ui/StatePanel";

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

type TeamMessage = {
  messageId: string;
  teamCode: string;
  senderUserId: string;
  senderNickname: string;
  receiverUserId: string;
  receiverNickname: string;
  title: string;
  content: string;
  createdAt: string;
};

type TabKey = "receivedRequests" | "sentRequests" | "receivedMessages" | "sentMessages";

const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
const TEAM_MESSAGES_STORAGE_KEY = "team-messages-v1";
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

function toMessage(message: Partial<TeamMessage>) {
  const messageId = typeof message.messageId === "string" ? message.messageId : "";
  const teamCode = typeof message.teamCode === "string" ? message.teamCode : "";
  const senderUserId = normalizeUserId(message.senderUserId);
  const receiverUserId = normalizeUserId(message.receiverUserId);
  const title = typeof message.title === "string" ? message.title : "";
  const content = typeof message.content === "string" ? message.content : "";
  const createdAt = typeof message.createdAt === "string" ? message.createdAt : "";

  if (!messageId || !teamCode || !senderUserId || !receiverUserId || !title || !content || !createdAt) {
    return null;
  }

  return {
    messageId,
    teamCode,
    senderUserId,
    senderNickname:
      typeof message.senderNickname === "string" && message.senderNickname.trim()
        ? message.senderNickname
        : "Member",
    receiverUserId,
    receiverNickname:
      typeof message.receiverNickname === "string" && message.receiverNickname.trim()
        ? message.receiverNickname
        : "Member",
    title,
    content,
    createdAt,
  } satisfies TeamMessage;
}

function readMessages() {
  if (typeof window === "undefined") return [] as TeamMessage[];

  try {
    const raw = window.localStorage.getItem(TEAM_MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<TeamMessage>[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((message) => toMessage(message))
      .filter((message): message is TeamMessage => message !== null);
  } catch {
    return [];
  }
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
      if (Array.isArray(parsed)) {
        collected.push(...parsed);
      }
    } catch {
      continue;
    }
  }

  return collected;
}

export default function FloatingMessageHub() {
  const [nickname, setNickname] = useState("");
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("receivedRequests");
  const [selectedMessage, setSelectedMessage] = useState<TeamMessage | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<{ item: TeamJoinRequest; ownerView: boolean } | null>(null);
  const [hubReady, setHubReady] = useState(false);
  const [hubError, setHubError] = useState("");
  const [teamsByCode, setTeamsByCode] = useState<Record<string, string>>({});
  const [receivedRequests, setReceivedRequests] = useState<TeamJoinRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<TeamJoinRequest[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<TeamMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<TeamMessage[]>([]);

  useEffect(() => {
    function syncHub() {
      try {
        setHubError("");
        const session = getCurrentSession();
        const nextUserId = normalizeUserId(session?.userId);
        setNickname(session?.nickname ?? "");
        setUserId(nextUserId);

        if (!nextUserId) {
          setTeamsByCode({});
          setReceivedRequests([]);
          setSentRequests([]);
          setReceivedMessages([]);
          setSentMessages([]);
          setOpen(false);
          setSelectedMessage(null);
          setHubReady(true);
          return;
        }

        const teams = readTeams();
        const teamsMap = teams.reduce<Record<string, string>>((acc, team) => {
          acc[team.teamCode] = team.name;
          return acc;
        }, {});
        const teamOwners = getTeamOwners();
        const myTeamCodes = teams
          .filter((team) => teamOwners[team.teamCode] === nextUserId)
          .map((team) => team.teamCode);
        const allRequests = readJoinRequests();
        const allMessages = readMessages();

        setTeamsByCode(teamsMap);
        setReceivedRequests(
          allRequests
            .filter((request) => myTeamCodes.includes(request.teamCode))
            .sort(compareRequests)
        );
        setSentRequests(
          allRequests
            .filter((request) => request.requesterId === nextUserId)
            .sort(compareRequests)
        );
        setReceivedMessages(
          allMessages
            .filter((message) => normalizeUserId(message.receiverUserId) === nextUserId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
        setSentMessages(
          allMessages
            .filter((message) => normalizeUserId(message.senderUserId) === nextUserId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        );
        setHubReady(true);
      } catch {
        setHubError("메시지 허브 데이터를 불러오는 중 문제가 발생했습니다.");
        setHubReady(true);
      }
    }

    syncHub();
    window.addEventListener(AUTH_CHANGED_EVENT, syncHub);
    window.addEventListener(MESSAGE_HUB_CHANGED_EVENT, syncHub);
    window.addEventListener("storage", syncHub);
    window.addEventListener("focus", syncHub);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncHub);
      window.removeEventListener(MESSAGE_HUB_CHANGED_EVENT, syncHub);
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
  const hubBadgeCount = pendingReceivedRequestCount + receivedMessages.length;

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
        window.dispatchEvent(new Event(MESSAGE_HUB_CHANGED_EVENT));

        setReceivedRequests((current) =>
          current.map((request) =>
            request.teamCode === item.teamCode &&
            request.requesterId === item.requesterId &&
            request.createdAt === item.createdAt
              ? { ...request, status: nextStatus, respondedAt }
              : request
          )
        );
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

function renderRequestGroups(groups: Record<string, TeamJoinRequest[]>, emptyText: string, showRequester: boolean) {
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
          <div key={teamCode} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
            <div style={{ fontWeight: 900, color: "#111827", marginBottom: "12px" }}>{teamsByCode[teamCode] || teamCode}</div>
            <div style={{ display: "grid", gap: "10px" }}>
              {items.map((item) => {
                const badge = getStatusBadge(item.status);

                return (
                  <div
                    key={`${item.teamCode}-${item.requesterId}-${item.createdAt}`}
                    style={{
                      borderRadius: "14px",
                      background: item.status === "pending" ? "#f8fbff" : "#ffffff",
                      border: item.status === "pending" ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
                      boxShadow: item.status === "pending" ? "0 10px 24px rgba(37, 99, 235, 0.08)" : "none",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                      <div>
                        <div style={{ fontWeight: 800, color: "#111827" }}>{showRequester ? item.requesterName || item.requesterId : nickname}</div>
                        <div style={{ color: "#6b7280", fontSize: "13px", marginTop: "4px" }}>
                          {item.role?.trim() ? `지원 포지션 ${item.role}` : "지원 포지션 미입력"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>
                          {badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedRequest({ item, ownerView: showRequester })}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "8px 12px",
                            borderRadius: "10px",
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#374151",
                            fontWeight: 800,
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          상세 보기
                        </button>
                      </div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "13px" }}>생성일 {formatDate(item.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderMessageList(items: TeamMessage[], emptyText: string, type: "received" | "sent") {
    if (!hubReady) {
      return <StatePanel kind="loading" compact title="목록을 불러오는 중입니다" description="잠시만 기다려 주세요." />;
    }

    if (hubError) {
      return <StatePanel kind="error" compact title={hubError} description="다시 시도해 주세요." />;
    }

    if (items.length === 0) {
      return <StatePanel kind="empty" compact title={emptyText} />;
    }

    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {items.map((item) => (
          <div key={item.messageId} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
              <div>
                <div style={{ fontWeight: 900, color: "#111827" }}>{item.title}</div>
                <div style={{ color: "#6b7280", fontSize: "14px" }}>{teamsByCode[item.teamCode] || item.teamCode}</div>
                <div style={{ color: "#374151", fontSize: "13px", marginTop: "6px" }}>
                  {type === "received" ? `보낸 사람 ${item.senderNickname}` : `받는 사람 ${item.receiverNickname}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMessage(item)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                상세 보기
              </button>
            </div>
            <div style={{ color: "#6b7280", fontSize: "13px" }}>생성일 {formatDate(item.createdAt)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close panel"
          style={{
            position: "fixed",
            inset: 0,
            border: "none",
            background: "rgba(15, 23, 42, 0.18)",
            padding: 0,
            margin: 0,
            zIndex: 69,
            cursor: "pointer",
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="쪽지 허브 열기"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          width: "60px",
          height: "60px",
          borderRadius: "999px",
          border: "none",
          background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
          color: "#ffffff",
          fontWeight: 900,
          fontSize: "14px",
          boxShadow: "0 18px 40px rgba(37, 99, 235, 0.35)",
          cursor: "pointer",
          zIndex: 70,
        }}
      >
        MSG
        {hubBadgeCount > 0 ? (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "24px",
              height: "24px",
              padding: "0 6px",
              borderRadius: "999px",
              background: "#ef4444",
              color: "#ffffff",
              fontWeight: 900,
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 24px rgba(239, 68, 68, 0.35)",
            }}
          >
            {hubBadgeCount > 99 ? "99+" : hubBadgeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          style={{
            position: "fixed",
            right: "20px",
            bottom: "92px",
            width: "min(400px, calc(100vw - 24px))",
            maxHeight: "min(70vh, 680px)",
            overflow: "hidden",
            borderRadius: "24px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
            zIndex: 70,
            display: "grid",
            gridTemplateRows: "auto auto 1fr",
          }}
        >
          <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid #eef2f7" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 800, marginBottom: "4px" }}>MESSAGE HUB</div>
                <div style={{ fontSize: "22px", fontWeight: 900, color: "#111827" }}>안녕하세요, {nickname}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                X
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", padding: "12px 18px", borderBottom: "1px solid #eef2f7", flexWrap: "wrap" }}>
            {[
              { key: "receivedRequests", label: "받은 요청", count: receivedRequests.length },
              { key: "sentRequests", label: "보낸 요청", count: sentRequests.length },
              { key: "receivedMessages", label: "받은 쪽지", count: receivedMessages.length },
              { key: "sentMessages", label: "보낸 쪽지", count: sentMessages.length },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: activeTab === tab.key ? "1px solid #2563eb" : "1px solid #d1d5db",
                  background: activeTab === tab.key ? "#dbeafe" : "#ffffff",
                  color: activeTab === tab.key ? "#1d4ed8" : "#374151",
                  fontWeight: 800,
                  fontSize: "13px",
                  boxShadow: activeTab === tab.key ? "0 10px 24px rgba(37, 99, 235, 0.12)" : "none",
                  cursor: "pointer",
                }}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div style={{ overflow: "auto", padding: "18px" }}>
            {activeTab === "receivedRequests" ? renderRequestGroups(groupedReceivedRequests, "아직 받은 요청이 없습니다.", true) : null}
            {activeTab === "sentRequests" ? renderRequestGroups(groupedSentRequests, "아직 보낸 요청이 없습니다.", false) : null}
            {activeTab === "receivedMessages" ? renderMessageList(receivedMessages, "아직 받은 쪽지가 없습니다.", "received") : null}
            {activeTab === "sentMessages" ? renderMessageList(sentMessages, "아직 보낸 쪽지가 없습니다.", "sent") : null}
          </div>
        </div>
      ) : null}

      {selectedRequest ? (
        <>
          <button
            type="button"
            aria-label="요청 상세 닫기"
            onClick={() => setSelectedRequest(null)}
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
          <div
            style={{
              position: "fixed",
              right: "20px",
              bottom: "92px",
              width: "min(420px, calc(100vw - 24px))",
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
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
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
                      <span style={{ display: "inline-block", marginLeft: "8px", padding: "4px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>
                        {badge.label}
                      </span>
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
                      <a
                        href={selectedRequest.item.portfolioUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#2563eb", fontWeight: 800, wordBreak: "break-all" }}
                      >
                        {selectedRequest.item.portfolioUrl}
                      </a>
                    </div>
                  ) : null}

                  {selectedRequest.ownerView && selectedRequest.item.status === "pending" ? (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => updateJoinRequestStatus(selectedRequest.item, "rejected")}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "12px",
                          border: "1px solid #d1d5db",
                          background: "#ffffff",
                          color: "#374151",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        거절
                      </button>
                      <button
                        type="button"
                        onClick={() => updateJoinRequestStatus(selectedRequest.item, "accepted")}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "12px",
                          border: "none",
                          background: "#2563eb",
                          color: "#ffffff",
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
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
            aria-label="Close message detail"
            onClick={() => setSelectedMessage(null)}
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
          <div
            style={{
              position: "fixed",
              right: "20px",
              bottom: "92px",
              width: "min(420px, calc(100vw - 24px))",
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
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                X
              </button>
            </div>

            <div style={{ display: "grid", gap: "8px", marginBottom: "16px", color: "#4b5563", fontSize: "14px" }}>
              <div>팀 {teamsByCode[selectedMessage.teamCode] || selectedMessage.teamCode}</div>
              <div>보낸 사람 {selectedMessage.senderNickname}</div>
              <div>받는 사람 {selectedMessage.receiverNickname}</div>
              <div>생성 시각 {formatDate(selectedMessage.createdAt)}</div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "16px",
                color: "#111827",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedMessage.content}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
