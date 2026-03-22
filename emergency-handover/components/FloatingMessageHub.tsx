"use client";

import initialTeams from "../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../lib/local-auth";

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

function getStatusBadge(status: "pending" | "accepted" | "rejected") {
  if (status === "accepted") {
    return { label: "Accepted", background: "#e8f7ea", color: "#1e7a35" };
  }

  if (status === "rejected") {
    return { label: "Rejected", background: "#f3f4f6", color: "#4b5563" };
  }

  return { label: "Pending", background: "#eef4ff", color: "#2457c5" };
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
  const [teamsByCode, setTeamsByCode] = useState<Record<string, string>>({});
  const [receivedRequests, setReceivedRequests] = useState<TeamJoinRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<TeamJoinRequest[]>([]);
  const [receivedMessages, setReceivedMessages] = useState<TeamMessage[]>([]);
  const [sentMessages, setSentMessages] = useState<TeamMessage[]>([]);

  useEffect(() => {
    function syncHub() {
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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      setSentRequests(
        allRequests
          .filter((request) => request.requesterId === nextUserId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

function renderRequestGroups(groups: Record<string, TeamJoinRequest[]>, emptyText: string, showRequester: boolean) {
    const entries = Object.entries(groups);

    if (entries.length === 0) {
      return (
        <div style={{ borderRadius: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px", color: "#6b7280" }}>
          {emptyText}
        </div>
      );
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
                  <div key={`${item.teamCode}-${item.requesterId}-${item.createdAt}`} style={{ borderRadius: "14px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{showRequester ? item.requesterName || item.requesterId : nickname}</div>
                      <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: badge.background, color: badge.color, fontWeight: 800, fontSize: "12px" }}>
                        {badge.label}
                      </span>
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
    if (items.length === 0) {
      return (
        <div style={{ borderRadius: "16px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px", color: "#6b7280" }}>
          {emptyText}
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: "12px" }}>
        {items.map((item) => (
          <div key={item.messageId} style={{ borderRadius: "18px", background: "#fbfcfe", border: "1px solid #edf0f5", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "8px" }}>
              <div>
                <div style={{ fontWeight: 900, color: "#111827" }}>{item.title}</div>
                <div style={{ color: "#6b7280", fontSize: "14px" }}>{teamsByCode[item.teamCode] || item.teamCode}</div>
              </div>
              <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontWeight: 800, fontSize: "12px" }}>
                {type === "received" ? "받음" : "보냄"}
              </span>
            </div>
            <div style={{ color: "#374151", fontSize: "14px", marginBottom: "6px" }}>
              {type === "received" ? `보낸 사람 ${item.senderNickname}` : `받는 사람 ${item.receiverNickname}`}
            </div>
            <div style={{ color: "#374151", lineHeight: 1.6, marginBottom: "6px" }}>{item.content}</div>
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
        aria-label="Open message hub"
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
        Msg
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
              { key: "receivedRequests", label: "받은 Request" },
              { key: "sentRequests", label: "보낸 Request" },
              { key: "receivedMessages", label: "받은 Message" },
              { key: "sentMessages", label: "보낸 Message" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as TabKey)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "12px",
                  border: activeTab === tab.key ? "1px solid #2563eb" : "1px solid #d1d5db",
                  background: activeTab === tab.key ? "#eff6ff" : "#ffffff",
                  color: activeTab === tab.key ? "#2563eb" : "#374151",
                  fontWeight: 800,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ overflow: "auto", padding: "18px" }}>
            {activeTab === "receivedRequests" ? renderRequestGroups(groupedReceivedRequests, "아직 받은 Request가 없습니다.", true) : null}
            {activeTab === "sentRequests" ? renderRequestGroups(groupedSentRequests, "아직 보낸 Request가 없습니다.", false) : null}
            {activeTab === "receivedMessages" ? renderMessageList(receivedMessages, "아직 받은 Message가 없습니다.", "received") : null}
            {activeTab === "sentMessages" ? renderMessageList(sentMessages, "아직 보낸 Message가 없습니다.", "sent") : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
