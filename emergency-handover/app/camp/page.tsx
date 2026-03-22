"use client";

import Link from "next/link";
import initialTeams from "../../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  getCurrentSession,
  getStoredUsers,
  getTeamOwners,
  saveTeamOwners,
} from "../../lib/local-auth";

type Team = {
  teamCode: string;
  hackathonSlug: string;
  name: string;
  isOpen: boolean;
  memberCount: number;
  lookingFor: string[];
  intro: string;
  contact: {
    type: string;
    url: string;
  };
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

function makeTeamCode() {
  return `T-${Date.now()}`;
}

function resolveMessageReceiver(teamCode: string, teamOwners: Record<string, string>) {
  const receiverUserId = teamOwners[teamCode] || "";
  if (!receiverUserId) {
    return null;
  }

  const receiverUser = getStoredUsers().find((user) => user.id === receiverUserId);
  if (!receiverUser?.nickname) {
    return null;
  }

  return {
    receiverUserId,
    receiverNickname: receiverUser.nickname,
  };
}

export default function CampPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [hackathonFilter, setHackathonFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const [name, setName] = useState("");
  const [hackathonSlug, setHackathonSlug] = useState("daker-handover-2026-03");
  const [memberCount, setMemberCount] = useState(1);
  const [lookingFor, setLookingFor] = useState("");
  const [intro, setIntro] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [editingTeamCode, setEditingTeamCode] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentNickname, setCurrentNickname] = useState("");
  const [teamOwners, setTeamOwners] = useState<Record<string, string>>({});
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageTeamCode, setMessageTeamCode] = useState("");
  const [messageTeamName, setMessageTeamName] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageError, setMessageError] = useState("");

  function persistTeams(nextTeams: Team[]) {
    setTeams(nextTeams);
    localStorage.setItem("teams", JSON.stringify(nextTeams));
  }

  function persistOwners(nextOwners: Record<string, string>) {
    setTeamOwners(nextOwners);
    saveTeamOwners(nextOwners);
  }

  function resetForm() {
    setEditingTeamCode("");
    setName("");
    setHackathonSlug("daker-handover-2026-03");
    setMemberCount(1);
    setLookingFor("");
    setIntro("");
    setContactUrl("");
    setIsOpen(true);
  }

  function syncAuthState() {
    const session = getCurrentSession();
    setCurrentUserId(session?.userId ?? "");
    setCurrentNickname(session?.nickname ?? "");
  }

  useEffect(() => {
    const savedTeams = localStorage.getItem("teams");
    let mergedTeams: Team[] = [];
    if (savedTeams) {
      try {
        const parsed = JSON.parse(savedTeams) as Team[];
        mergedTeams = parsed;
      } catch {
        mergedTeams = initialTeams as Team[];
      }
    } else {
      mergedTeams = initialTeams as Team[];
      localStorage.setItem("teams", JSON.stringify(mergedTeams));
    }

    window.requestAnimationFrame(() => setTeams(mergedTeams));
    window.requestAnimationFrame(() => setTeamOwners(getTeamOwners()));
    window.requestAnimationFrame(() => syncAuthState());

    const params = new URLSearchParams(window.location.search);
    const hackathonParam = params.get("hackathon");
    if (hackathonParam) {
      window.requestAnimationFrame(() => setHackathonFilter(hackathonParam));
    }

    function syncOwners() {
      setTeamOwners(getTeamOwners());
    }

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("storage", syncOwners);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("storage", syncOwners);
    };
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const matchesHackathon = hackathonFilter
        ? team.hackathonSlug === hackathonFilter
        : true;

      const matchesOpen = openOnly ? team.isOpen : true;

      return matchesHackathon && matchesOpen;
    });
  }, [teams, hackathonFilter, openOnly]);

  const uniqueHackathons = useMemo(() => {
    const slugs = [...new Set(teams.map((team) => team.hackathonSlug))];
    return slugs;
  }, [teams]);

  function isOwner(teamCode: string) {
    return !!currentUserId && teamOwners[teamCode] === currentUserId;
  }

  function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId) {
      alert("팀 모집글을 작성하거나 관리하려면 Login이 필요합니다.");
      return;
    }

    if (!name.trim() || !intro.trim() || !contactUrl.trim()) {
      alert("팀 이름, 소개, 연락 링크를 입력해 주세요.");
      return;
    }

    if (editingTeamCode && !isOwner(editingTeamCode)) {
      alert("팀 소유자만 수정할 수 있습니다.");
      return;
    }

    const nextTeamCode = editingTeamCode || makeTeamCode();
    const nextTeam: Team = {
      teamCode: nextTeamCode,
      hackathonSlug,
      name: name.trim(),
      isOpen,
      memberCount: Number(memberCount),
      lookingFor: lookingFor
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      intro: intro.trim(),
      contact: {
        type: "link",
        url: contactUrl.trim(),
      },
      createdAt: new Date().toISOString(),
    };

    if (editingTeamCode) {
      const updatedTeams = teams.map((team) =>
        team.teamCode === editingTeamCode
          ? {
              ...nextTeam,
              createdAt: team.createdAt,
            }
          : team
      );

      persistTeams(updatedTeams);
      resetForm();
      alert("정상적으로 수정되었습니다.");
      return;
    }

    const updatedTeams = [nextTeam, ...teams];
    persistTeams(updatedTeams);
    persistOwners({
      ...teamOwners,
      [nextTeamCode]: currentUserId,
    });
    resetForm();
    alert("정상적으로 등록되었습니다.");
  }

  function handleEditTeam(teamCode: string) {
    if (!isOwner(teamCode)) {
      alert("팀 소유자만 수정할 수 있습니다.");
      return;
    }

    const team = teams.find((item) => item.teamCode === teamCode);
    if (!team) return;

    setEditingTeamCode(team.teamCode);
    setName(team.name);
    setHackathonSlug(team.hackathonSlug);
    setMemberCount(team.memberCount);
    setLookingFor(team.lookingFor.join(", "));
    setIntro(team.intro);
    setContactUrl(team.contact.url);
    setIsOpen(team.isOpen);
  }

  function handleToggleTeamOpen(teamCode: string, nextOpen: boolean) {
    if (!isOwner(teamCode)) {
      alert("팀 소유자만 관리할 수 있습니다.");
      return;
    }

    const updatedTeams = teams.map((team) =>
      team.teamCode === teamCode
        ? {
            ...team,
            isOpen: nextOpen,
          }
        : team
    );

    persistTeams(updatedTeams);
  }

  function handleCancelEdit() {
    resetForm();
  }

  function resetMessageForm() {
    setMessageModalOpen(false);
    setMessageTeamCode("");
    setMessageTeamName("");
    setMessageTitle("");
    setMessageContent("");
    setMessageError("");
  }

  function handleOpenMessageModal(team: Team) {
    if (!currentUserId) {
      alert("쪽지를 보내려면 Login이 필요합니다.");
      return;
    }

    setMessageTeamCode(team.teamCode);
    setMessageTeamName(team.name);
    setMessageTitle("");
    setMessageContent("");
    setMessageError("");
    setMessageModalOpen(true);
  }

  function handleSendMessage(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!currentUserId) {
      setMessageError("쪽지를 보내려면 Login이 필요합니다.");
      return;
    }

    if (!messageTitle.trim() || !messageContent.trim()) {
      setMessageError("제목과 내용을 입력해 주세요.");
      return;
    }

    let existingMessages: TeamMessage[] = [];

    try {
      const raw = localStorage.getItem(TEAM_MESSAGES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as TeamMessage[];
        existingMessages = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      existingMessages = [];
    }

    const receiver = resolveMessageReceiver(messageTeamCode, teamOwners);

    if (!receiver) {
      setMessageError("팀 소유자 정보를 찾을 수 없습니다.");
      return;
    }

    const nextMessage: TeamMessage = {
      messageId: `M-${Date.now()}`,
      teamCode: messageTeamCode,
      senderUserId: currentUserId,
      senderNickname: currentNickname || "Member",
      receiverUserId: receiver.receiverUserId,
      receiverNickname: receiver.receiverNickname,
      title: messageTitle.trim(),
      content: messageContent.trim(),
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(
      TEAM_MESSAGES_STORAGE_KEY,
      JSON.stringify([nextMessage, ...existingMessages])
    );
    window.dispatchEvent(new Event(MESSAGE_HUB_CHANGED_EVENT));

    resetMessageForm();
    alert("정상적으로 전송되었습니다.");
  }

  return (
    <main style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "10px" }}>
          팀원 모집
        </h1>
        <p style={{ color: "#555", lineHeight: 1.6 }}>
          팀 모집글을 확인하고, 내 모집글을 수정하거나 모집 상태를 관리할 수 있습니다.
        </p>
      </div>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          backgroundColor: "#fff",
          marginBottom: "28px",
        }}
      >
        <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
          필터
        </h2>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              해커톤
            </label>
            <select
              value={hackathonFilter}
              onChange={(e) => setHackathonFilter(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                minWidth: "280px",
              }}
            >
              <option value="">전체</option>
              {uniqueHackathons.map((slug) => (
                <option key={slug} value={slug}>
                  {getHackathonTitle(slug)}
                </option>
              ))}
            </select>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "28px",
              fontWeight: "bold",
            }}
          >
            <input
              type="checkbox"
              checked={openOnly}
              onChange={(e) => setOpenOnly(e.target.checked)}
            />
            Open만 보기
          </label>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          backgroundColor: "#fff",
          marginBottom: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>
            {editingTeamCode ? "팀 모집글 수정" : "팀 모집글 작성"}
          </h2>
          {currentNickname ? (
            <div style={{ color: "#374151", fontWeight: 700 }}>현재 Login 사용자: {currentNickname}</div>
          ) : null}
        </div>

        {!currentUserId && (
          <div
            style={{
              borderRadius: "14px",
              padding: "14px 16px",
              background: "#f8fafc",
              border: "1px solid #e5e7eb",
              color: "#4b5563",
              marginBottom: "18px",
            }}
          >
            팀 모집글을 작성하거나 관리하려면 Login이 필요합니다. <Link href="/auth?mode=login&redirect=/camp" style={{ color: "#2563eb", fontWeight: 800 }}>Login 하러 가기</Link>
          </div>
        )}

        <form onSubmit={handleCreateTeam}>
          <div
            style={{
              display: "grid",
              gap: "16px",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                팀 이름
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="vibe-builders"
                disabled={!currentUserId}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                해커톤
              </label>
              <select
                value={hackathonSlug}
                onChange={(e) => setHackathonSlug(e.target.value)}
                disabled={!currentUserId}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
                }}
              >
                <option value="aimers-8-model-lite">Aimers 8</option>
                <option value="monthly-vibe-coding-2026-02">Monthly Vibe Coding 2026.02</option>
                <option value="daker-handover-2026-03">Daker Handover 2026.03</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                팀 인원
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={memberCount}
                onChange={(e) => setMemberCount(Number(e.target.value))}
                disabled={!currentUserId}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                모집 상태
              </label>
              <select
                value={isOpen ? "open" : "closed"}
                onChange={(e) => setIsOpen(e.target.value === "open")}
                disabled={!currentUserId}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
                }}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              모집 포지션
            </label>
            <input
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              placeholder="Frontend, Designer"
              disabled={!currentUserId}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
              }}
            />
            <p style={{ marginTop: "6px", color: "#666", fontSize: "14px" }}>
              여러 역할은 쉼표로 구분해 주세요.
            </p>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              팀 소개
            </label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="팀 소개와 모집 내용을 입력해 주세요"
              rows={4}
              disabled={!currentUserId}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                resize: "vertical",
                backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
              }}
            />
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              연락 링크
            </label>
            <input
              value={contactUrl}
              onChange={(e) => setContactUrl(e.target.value)}
              placeholder="https://open.kakao.com/..."
              disabled={!currentUserId}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                backgroundColor: currentUserId ? "#fff" : "#f3f4f6",
              }}
            />
          </div>

          <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={!currentUserId}
              style={{
                padding: "12px 18px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: currentUserId ? "#2563eb" : "#9ca3af",
                color: "#fff",
                fontWeight: "bold",
                cursor: currentUserId ? "pointer" : "not-allowed",
              }}
            >
              {editingTeamCode ? "수정하기" : "등록하기"}
            </button>

            {editingTeamCode && (
              <button
                type="button"
                onClick={handleCancelEdit}
                style={{
                  padding: "12px 18px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
                  backgroundColor: "#fff",
                  color: "#374151",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                취소
              </button>
            )}
          </div>
        </form>
      </section>

      <section
        style={{
          border: "1px solid #ddd",
          borderRadius: "16px",
          padding: "24px",
          backgroundColor: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>팀 모집글</h2>
          <p style={{ color: "#666" }}>총 {filteredTeams.length}개</p>
        </div>

        <div style={{ display: "grid", gap: "16px" }}>
          {filteredTeams.length > 0 ? (
            filteredTeams.map((team) => {
              const canManage = isOwner(team.teamCode);

              return (
                <article
                  key={team.teamCode}
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: "14px",
                    padding: "20px",
                    backgroundColor: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "16px",
                      flexWrap: "wrap",
                      marginBottom: "10px",
                    }}
                  >
                    <div>
                      <h3 style={{ fontSize: "22px", fontWeight: "bold", marginBottom: "8px" }}>
                        {team.name}
                      </h3>
                      <p style={{ color: "#555", marginBottom: "6px" }}>
                        {getHackathonTitle(team.hackathonSlug)}
                      </p>
                      {canManage ? (
                        <p style={{ color: "#2563eb", fontWeight: 700, margin: 0 }}>내 모집글</p>
                      ) : null}
                    </div>

                    <div>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "6px 10px",
                          borderRadius: "999px",
                          backgroundColor: team.isOpen ? "#e8f7ea" : "#eee",
                          color: team.isOpen ? "#1e7a35" : "#666",
                          fontWeight: "bold",
                          fontSize: "14px",
                        }}
                      >
                        {team.isOpen ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>

                  <p style={{ marginBottom: "8px" }}>
                    <strong>팀 인원:</strong> {team.memberCount}
                  </p>

                  <p style={{ marginBottom: "10px", lineHeight: 1.7 }}>
                    <strong>소개:</strong> {team.intro}
                  </p>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>모집 포지션</strong>{" "}
                    {team.lookingFor.length > 0 ? (
                      team.lookingFor.map((role) => (
                        <span
                          key={role}
                          style={{
                            display: "inline-block",
                            marginRight: "8px",
                            marginTop: "6px",
                            padding: "6px 10px",
                            borderRadius: "999px",
                            backgroundColor: "#eef4ff",
                            color: "#2457c5",
                            fontSize: "14px",
                          }}
                        >
                          {role}
                        </span>
                      ))
                    ) : (
                      <span>없음</span>
                    )}
                  </div>

                  <p style={{ marginBottom: "10px" }}>
                    <strong>등록일:</strong> {formatDate(team.createdAt)}
                  </p>

                  <a href={team.contact.url} target="_blank" rel="noreferrer">
                    연락 링크 열기
                  </a>

                  {canManage ? (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      <button
                        type="button"
                        onClick={() => handleEditTeam(team.teamCode)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #d1d5db",
                          backgroundColor: "#fff",
                          color: "#374151",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleTeamOpen(team.teamCode, !team.isOpen)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: team.isOpen ? "#111827" : "#2563eb",
                          color: "#fff",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        {team.isOpen ? "모집 마감" : "모집 재오픈"}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px" }}>
                      <button
                        type="button"
                        onClick={() => handleOpenMessageModal(team)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: "#2563eb",
                          color: "#fff",
                          fontWeight: "bold",
                          cursor: "pointer",
                        }}
                      >
                        쪽지 보내기
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <p>조건에 맞는 팀이 없습니다.</p>
          )}
        </div>
      </section>

      {messageModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 60,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              borderRadius: "24px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: 900, color: "#111827" }}>
              쪽지 보내기
            </h3>
            <p style={{ margin: "0 0 16px", color: "#4b5563", lineHeight: 1.7 }}>
              {messageTeamName} 팀에 쪽지를 보냅니다.
            </p>

            <form onSubmit={handleSendMessage} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
                  제목
                </label>
                <input
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  placeholder="제목을 입력해 주세요"
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "0 14px",
                    borderRadius: "14px",
                    border: "1px solid #d1d5db",
                    background: "#fbfcfe",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
                  Message 내용
                </label>
                <textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="보낼 내용을 입력해 주세요"
                  rows={5}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "14px",
                    border: "1px solid #d1d5db",
                    background: "#fbfcfe",
                    resize: "vertical",
                  }}
                />
              </div>

              {messageError ? (
                <div
                  style={{
                    borderRadius: "14px",
                    padding: "12px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {messageError}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={resetMessageForm}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "14px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#374151",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "12px 16px",
                    borderRadius: "14px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  보내기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
