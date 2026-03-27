"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import initialTeams from "../../data/public_teams.json";
import hackathonsData from "../../data/public_hackathons.json";
import StatePanel from "../../components/ui/StatePanel";
import {
  AUTH_CHANGED_EVENT,
  getCurrentSession,
  getStoredUsers,
  getTeamOwners,
  saveTeamOwners,
} from "../../lib/local-auth";
import {
  findDirectMessageThreadBetweenUsers,
  sendDirectMessage,
} from "../../lib/direct-messages";

type Team = {
  teamCode: string;
  hackathonSlug?: string;
  name: string;
  isOpen?: boolean;
  memberCount?: number;
  lookingFor?: string[];
  intro: string;
  contact?: {
    type?: string;
    url?: string;
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

type TeamJoinRequest = {
  teamCode: string;
  requesterId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
};

type HackathonMeta = {
  slug: string;
  title: string;
};

type TeamSection = {
  key: string;
  title: string;
  teams: Team[];
};

const TEAM_MESSAGES_STORAGE_KEY = "team-messages-v1";
const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1:";
const MESSAGE_HUB_CHANGED_EVENT = "message-hub-changed";
const UNASSIGNED_HACKATHON_KEY = "__unassigned__";

const hackathonCatalog = (hackathonsData as HackathonMeta[]).map((item) => ({
  slug: item.slug,
  title: item.title,
}));

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decodeEscapedUnicode(value: string) {
  const normalized = value.replace(/\\u\{/g, String.raw`\u{`).replace(/\\u/g, String.raw`\u`);

  return normalized
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (match, hex: string) => {
      try {
        return String.fromCodePoint(parseInt(hex, 16));
      } catch {
        return match;
      }
    })
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function normalizeDisplayText(value: string | undefined) {
  if (!value) return "";
  return decodeEscapedUnicode(value).trim();
}

function normalizeTeam(team: Team): Team {
  return {
    ...team,
    hackathonSlug: (team.hackathonSlug ?? "").trim(),
    name: normalizeDisplayText(team.name),
    intro: normalizeDisplayText(team.intro),
    lookingFor: (team.lookingFor ?? []).map((item) => normalizeDisplayText(item)).filter(Boolean),
    contact: team.contact
      ? {
          ...team.contact,
          type: normalizeDisplayText(team.contact.type),
          url: team.contact.url?.trim() ?? "",
        }
      : undefined,
  };
}

function compareTeamsByCreatedAtDesc(a: Team, b: Team) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function normalizeHackathonKey(team: Team, validSlugs: Set<string>) {
  const slug = (team.hackathonSlug ?? "").trim();
  if (!slug || !validSlugs.has(slug)) {
    return UNASSIGNED_HACKATHON_KEY;
  }

  return slug;
}

function buildTeamSections(filteredTeams: Team[], hackathons: HackathonMeta[], selectedSlug: string) {
  const validSlugs = new Set(hackathons.map((item) => item.slug));
  const grouped = new Map<string, Team[]>();

  for (const team of filteredTeams) {
    const key = selectedSlug || normalizeHackathonKey(team, validSlugs);
    const bucket = grouped.get(key) ?? [];
    bucket.push(team);
    grouped.set(key, bucket);
  }

  const sections: TeamSection[] = [];

  if (selectedSlug) {
    const teams = (grouped.get(selectedSlug) ?? []).slice().sort(compareTeamsByCreatedAtDesc);
    if (teams.length > 0) {
      const title = hackathons.find((item) => item.slug === selectedSlug)?.title ?? selectedSlug;
      sections.push({ key: selectedSlug, title, teams });
    }
    return sections;
  }

  for (const hackathon of hackathons) {
    const teams = grouped.get(hackathon.slug);
    if (!teams || teams.length === 0) continue;
    sections.push({
      key: hackathon.slug,
      title: hackathon.title,
      teams: teams.slice().sort(compareTeamsByCreatedAtDesc),
    });
  }

  const unassignedTeams = grouped.get(UNASSIGNED_HACKATHON_KEY);
  if (unassignedTeams && unassignedTeams.length > 0) {
    sections.push({
      key: UNASSIGNED_HACKATHON_KEY,
      title: "해커톤 미지정",
      teams: unassignedTeams.slice().sort(compareTeamsByCreatedAtDesc),
    });
  }

  return sections;
}

function getHackathonTitle(slug: string) {
  return hackathonCatalog.find((item) => item.slug === slug)?.title ?? slug;
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
      collected.push(...parsed);
    } catch {
      continue;
    }
  }

  return collected;
}

export default function CampPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsReady, setTeamsReady] = useState(false);
  const [teamsError, setTeamsError] = useState("");
  const [hackathonFilter, setHackathonFilter] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const [name, setName] = useState("");
  const [hackathonSlug, setHackathonSlug] = useState("");
  const [memberCount, setMemberCount] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [intro, setIntro] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [editingTeamCode, setEditingTeamCode] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentNickname, setCurrentNickname] = useState("");
  const [teamOwners, setTeamOwners] = useState<Record<string, string>>({});
  const [joinRequestVersion, setJoinRequestVersion] = useState(0);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [messageTeamCode, setMessageTeamCode] = useState("");
  const [messageTeamName, setMessageTeamName] = useState("");
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageError, setMessageError] = useState("");

  function persistTeams(nextTeams: Team[]) {
    const normalizedTeams = nextTeams.map((team) => normalizeTeam(team));
    setTeams(normalizedTeams);
    localStorage.setItem("teams", JSON.stringify(normalizedTeams));
  }

  function persistOwners(nextOwners: Record<string, string>) {
    setTeamOwners(nextOwners);
    saveTeamOwners(nextOwners);
  }

  function resetForm() {
    setEditingTeamCode("");
    setName("");
    setHackathonSlug("");
    setMemberCount("");
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
        mergedTeams = Array.isArray(parsed)
          ? parsed.map((team) => normalizeTeam(team))
          : (initialTeams as Team[]).map((team) => normalizeTeam(team));

        if (JSON.stringify(mergedTeams) !== savedTeams) {
          localStorage.setItem("teams", JSON.stringify(mergedTeams));
        }
      } catch {
        mergedTeams = (initialTeams as Team[]).map((team) => normalizeTeam(team));
        setTeamsError("? ??? ???? ? ??? ??????.");
      }
    } else {
      mergedTeams = (initialTeams as Team[]).map((team) => normalizeTeam(team));
      localStorage.setItem("teams", JSON.stringify(mergedTeams));
    }

    window.requestAnimationFrame(() => setTeams(mergedTeams));
    window.requestAnimationFrame(() => setTeamOwners(getTeamOwners()));
    window.requestAnimationFrame(() => syncAuthState());

    const params = new URLSearchParams(window.location.search);
    const hackathonParam = params.get("hackathon");
    if (hackathonParam) {
      window.requestAnimationFrame(() => setHackathonFilter(hackathonParam));
      window.requestAnimationFrame(() => setHackathonSlug(hackathonParam));
    }

    window.requestAnimationFrame(() => setTeamsReady(true));

    function syncOwners() {
      setTeamOwners(getTeamOwners());
    }

    function syncJoinRequests() {
      setJoinRequestVersion((current) => current + 1);
    }

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("storage", syncOwners);
    window.addEventListener("storage", syncJoinRequests);
    window.addEventListener(MESSAGE_HUB_CHANGED_EVENT, syncJoinRequests);
    window.addEventListener("focus", syncJoinRequests);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("storage", syncOwners);
      window.removeEventListener("storage", syncJoinRequests);
      window.removeEventListener(MESSAGE_HUB_CHANGED_EVENT, syncJoinRequests);
      window.removeEventListener("focus", syncJoinRequests);
    };
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
      const teamSlug = (team.hackathonSlug ?? "").trim();
      const matchesHackathon = hackathonFilter ? teamSlug === hackathonFilter : true;
      const matchesOpen = openOnly ? !!team.isOpen : true;
      return matchesHackathon && matchesOpen;
    });
  }, [teams, hackathonFilter, openOnly]);

  const teamSections = useMemo(() => {
    return buildTeamSections(filteredTeams, hackathonCatalog, hackathonFilter);
  }, [filteredTeams, hackathonFilter]);

  const uniqueHackathons = useMemo(() => hackathonCatalog.map((item) => item.slug), []);
  const allJoinRequests = readAllJoinRequests();
  const selectedHackathonMembership = useMemo(() => {
    const normalizedSlug = hackathonSlug.trim();
    if (!currentUserId || !normalizedSlug) return null;

    const ownedTeam = teams.find(
      (team) => (team.hackathonSlug ?? "").trim() === normalizedSlug && teamOwners[team.teamCode] === currentUserId
    );
    if (ownedTeam) {
      return { kind: "owner" as const, teamCode: ownedTeam.teamCode };
    }

    const acceptedRequest = allJoinRequests.find((request) => {
      if (request.requesterId !== currentUserId || request.status !== "accepted") return false;
      const targetTeam = teams.find((team) => team.teamCode === request.teamCode);
      return !!targetTeam && (targetTeam.hackathonSlug ?? "").trim() === normalizedSlug;
    });

    if (acceptedRequest) {
      return { kind: "member" as const, teamCode: acceptedRequest.teamCode };
    }

    return null;
  }, [allJoinRequests, currentUserId, hackathonSlug, teamOwners, teams]);

  function isOwner(teamCode: string) {
    return !!currentUserId && teamOwners[teamCode] === currentUserId;
  }

  function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!currentUserId) {
      alert("팀 모집글을 작성하거나 관리하려면 Login이 필요합니다.");
      return;
    }

    if (!name.trim() || !intro.trim()) {
      alert("팀 이름과 소개를 입력해 주세요.");
      return;
    }

    if (editingTeamCode && !isOwner(editingTeamCode)) {
      alert("팀 소유자만 수정할 수 있습니다.");
      return;
    }

    if (
      hackathonSlug.trim() &&
      selectedHackathonMembership &&
      (!editingTeamCode ||
        selectedHackathonMembership.kind !== "owner" ||
        selectedHackathonMembership.teamCode !== editingTeamCode)
    ) {
      alert(
        selectedHackathonMembership.kind === "owner"
          ? "이미 이 해커톤에서 팀을 운영 중이라 다른 팀을 추가로 만들 수 없습니다."
          : "이미 이 해커톤의 다른 팀에 소속되어 있어 새 팀을 만들 수 없습니다."
      );
      return;
    }

    const nextTeamCode = editingTeamCode || makeTeamCode();
    const trimmedMemberCount = memberCount.trim();

    const nextTeam: Team = {
      teamCode: nextTeamCode,
      hackathonSlug: hackathonSlug.trim(),
      name: name.trim(),
      isOpen,
      memberCount: trimmedMemberCount ? Number(trimmedMemberCount) : undefined,
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
    setHackathonSlug(team.hackathonSlug ?? "");
    setMemberCount(typeof team.memberCount === "number" ? String(team.memberCount) : "");
    setLookingFor((team.lookingFor ?? []).join(", "));
    setIntro(team.intro);
    setContactUrl(team.contact?.url ?? "");
    setIsOpen(team.isOpen ?? true);
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

    const receiver = resolveMessageReceiver(team.teamCode, teamOwners);
    if (!receiver) {
      alert("팀 소유자 정보를 찾을 수 없습니다.");
      return;
    }

    if (receiver.receiverUserId === currentUserId) {
      alert("자기 자신에게는 쪽지를 보낼 수 없습니다.");
      return;
    }

    const existingThread = findDirectMessageThreadBetweenUsers(currentUserId, receiver.receiverUserId);
    if (existingThread) {
      router.push(`/messages/${existingThread.id}`);
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

    if (receiver.receiverUserId === currentUserId) {
      setMessageError("자기 자신에게는 쪽지를 보낼 수 없습니다.");
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

    localStorage.setItem(TEAM_MESSAGES_STORAGE_KEY, JSON.stringify([nextMessage, ...existingMessages]));
    window.dispatchEvent(new Event(MESSAGE_HUB_CHANGED_EVENT));

    const sent = sendDirectMessage({
      currentUserId,
      currentUserNickname: currentNickname || "Member",
      otherUserId: receiver.receiverUserId,
      otherUserNickname: receiver.receiverNickname,
      title: messageTitle.trim(),
      body: messageContent.trim(),
      teamCode: messageTeamCode,
      teamName: messageTeamName,
    });

    resetMessageForm();
    alert("정상적으로 전송되었습니다.");

    if (sent) {
      router.push(`/messages/${sent.thread.id}`);
    }
  }

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="page-hero page-hero--dark" style={{ padding: "22px", marginBottom: "18px" }}>
          <span className="eyebrow">Team Matching</span>
          <h1 className="hero-title" style={{ marginTop: "10px", marginBottom: "10px" }}>
            {"팀원 모집"}
          </h1>
          <div className="hero-meta" style={{ marginTop: 0 }}>
            <span>{"전체 "}{teams.length}{"개"}</span>
            <span>{"모집중 "}{teams.filter((team) => team.isOpen).length}{"개"}</span>
            <span>{"현재 목록 "}{filteredTeams.length}{"개"}</span>
          </div>
        </section>

        <section className="form-shell" style={{ marginBottom: "18px" }}>
          <div className="section-header" style={{ marginBottom: "14px" }}>
            <div>
              <h2 className="section-title">필터</h2>
            </div>
          </div>

          <div className="toolbar" style={{ alignItems: "end" }}>
            <div className="field">
              <label htmlFor="camp-filter-hackathon">해커톤</label>
              <select id="camp-filter-hackathon" value={hackathonFilter} onChange={(e) => setHackathonFilter(e.target.value)} className="select">
                <option value="">전체</option>
                {uniqueHackathons.map((slug) => (
                  <option key={slug} value={slug}>
                    {getHackathonTitle(slug)}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "46px", color: "#334155", fontSize: "13px", fontWeight: 700 }}>
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              {"모집중만 보기"}
            </label>
          </div>
        </section>

        <section className="form-shell" style={{ marginBottom: "18px" }}>
          <div className="section-header" style={{ marginBottom: "14px" }}>
            <div>
              <h2 className="section-title">{editingTeamCode ? "팀 모집글 수정" : "팀 모집글 작성"}</h2>
            </div>
            {currentNickname ? <div className="muted" style={{ fontWeight: 700 }}>{"현재 Login 사용자 "}{currentNickname}</div> : null}
          </div>

          {!currentUserId ? (
            <div style={{ borderRadius: "14px", padding: "12px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", color: "#4b5563", marginBottom: "14px" }}>
              {"팀 모집글을 작성하거나 관리하려면 "}<Link href="/auth?mode=login&redirect=/camp" style={{ color: "#2563eb", fontWeight: 800 }}>Login</Link>{"이 필요합니다."}
            </div>
          ) : null}

          <form onSubmit={handleCreateTeam}>
            <div className="toolbar">
              <div className="field">
                <label htmlFor="camp-name">{"팀명 *"}</label>
                <input id="camp-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="vibe-builders" disabled={!currentUserId} />
              </div>

              <div className="field">
                <label htmlFor="camp-hackathon">{"연결 해커톤 (선택)"}</label>
                <select id="camp-hackathon" className="select" value={hackathonSlug} onChange={(e) => setHackathonSlug(e.target.value)} disabled={!currentUserId}>
                  <option value="">연결 안 함</option>
                  {uniqueHackathons.map((slug) => (
                    <option key={slug} value={slug}>{getHackathonTitle(slug)}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="camp-member-count">{"팀원 수 (선택)"}</label>
                <input id="camp-member-count" className="input" type="number" min={1} max={10} value={memberCount} onChange={(e) => setMemberCount(e.target.value)} disabled={!currentUserId} />
              </div>

              <div className="field">
                <label htmlFor="camp-open-state">{"모집 상태 (선택)"}</label>
                <select id="camp-open-state" className="select" value={isOpen ? "open" : "closed"} onChange={(e) => setIsOpen(e.target.value === "open")} disabled={!currentUserId}>
                  <option value="open">모집중</option>
                  <option value="closed">모집 마감</option>
                </select>
              </div>
            </div>

            <div className="stack-md" style={{ marginTop: "16px" }}>
              <div className="field">
                <label htmlFor="camp-looking-for">{"모집 포지션 (선택)"}</label>
                <input id="camp-looking-for" className="input" value={lookingFor} onChange={(e) => setLookingFor(e.target.value)} placeholder="Frontend, Designer" disabled={!currentUserId} />
                <div className="field-help">{"입력하지 않아도 저장할 수 있습니다."}</div>
              </div>

              <div className="field">
                <label htmlFor="camp-intro">{"소개 *"}</label>
                <textarea id="camp-intro" className="textarea" value={intro} onChange={(e) => setIntro(e.target.value)} placeholder={"팀 소개와 모집 내용을 입력해 주세요"} rows={4} disabled={!currentUserId} />
              </div>

              <div className="field">
                <label htmlFor="camp-contact-url">{"공개 연락 링크 (선택)"}</label>
                <input id="camp-contact-url" className="input" value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} placeholder="https://open.kakao.com/..." disabled={!currentUserId} />
                <div className="field-help">{"오픈채팅 또는 폼 링크처럼 공개 가능한 연락 수단만 입력해 주세요."}</div>
              </div>
            </div>

            <div className="inline-actions" style={{ marginTop: "18px" }}>
              <button type="submit" className="btn btn-primary" disabled={!currentUserId}>
                {editingTeamCode ? "수정하기" : "등록하기"}
              </button>
              {editingTeamCode ? (
                <button type="button" onClick={handleCancelEdit} className="btn btn-secondary">취소</button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="section-card">
          <div className="section-header" style={{ marginBottom: "14px" }}>
            <div>
              <h2 className="section-title">팀 모집글</h2>
            </div>
            <div className="muted" style={{ fontWeight: 700 }}>{"총 "}{filteredTeams.length}{"개"}</div>
          </div>

          <div style={{ display: "grid", gap: "16px" }}>
            {!teamsReady ? (
              <StatePanel kind="loading" compact title="팀 목록을 불러오는 중입니다" description="잠시만 기다려 주세요." />
            ) : teamsError ? (
              <StatePanel kind="error" compact title={teamsError} description="다시 시도해 주세요." />
            ) : teamSections.length > 0 ? (
              teamSections.map((section) => (
                <section key={section.key} style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid #eef2f7" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", lineHeight: 1.35, fontWeight: 800 }}>{section.title}</h3>
                    <div className="muted" style={{ fontSize: "12px", fontWeight: 700 }}>{section.teams.length}{"개"}</div>
                  </div>

                  <div style={{ display: "grid", gap: "12px" }}>
                    {section.teams.map((team) => {
                      const canManage = isOwner(team.teamCode);

                      return (
                        <article key={team.teamCode} style={{ border: "1px solid #e5e7eb", borderRadius: "16px", padding: "16px", backgroundColor: "#ffffff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "start", marginBottom: "10px" }}>
                            <div style={{ display: "grid", gap: "6px" }}>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                <h4 style={{ margin: 0, fontSize: "18px", lineHeight: 1.3, fontWeight: 800 }}>{team.name}</h4>
                                {canManage ? <span className="chip">내 모집글</span> : null}
                              </div>
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", color: "#64748b", fontSize: "12px" }}>
                                <span>{(team.hackathonSlug ?? "").trim() ? getHackathonTitle((team.hackathonSlug ?? "").trim()) : "연결된 해커톤 없음"}</span>
                                {typeof team.memberCount === "number" && team.memberCount > 0 ? <span>{"인원 "}{team.memberCount}{"명"}</span> : null}
                              </div>
                            </div>
                            <span className={team.isOpen ? "status-chip status-chip--open" : "status-chip status-chip--closed"}>{team.isOpen ? "모집중" : "모집 마감"}</span>
                          </div>

                          <div style={{ display: "grid", gap: "10px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                              {(team.lookingFor ?? []).length > 0 ? (team.lookingFor ?? []).map((role) => <span key={role} className="tag-chip">{role}</span>) : null}
                            </div>

                            <p style={{ margin: 0, color: "#374151", fontSize: "14px", lineHeight: 1.65 }}>{team.intro}</p>

                            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ display: "grid", gap: "6px" }}>
                                <div className="muted" style={{ fontSize: "12px" }}>{"등록일 "}{formatDate(team.createdAt)}</div>
                                {team.contact?.url ? (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                    <span className="muted" style={{ fontSize: "12px" }}>{"팀장이 공개한 연락 링크입니다."}</span>
                                    <a href={team.contact.url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ textDecoration: "none" }}>
                                      {"공개 연락 링크"}
                                    </a>
                                  </div>
                                ) : null}
                              </div>

                              <div className="inline-actions" style={{ justifyContent: "flex-end" }}>
                                {canManage ? (
                                  <>
                                    <button type="button" onClick={() => handleEditTeam(team.teamCode)} className="btn btn-secondary">수정</button>
                                    <button type="button" onClick={() => handleToggleTeamOpen(team.teamCode, !team.isOpen)} className={team.isOpen ? "btn btn-ghost" : "btn btn-primary"}>
                                      {team.isOpen ? "모집 마감" : "모집 재오픈"}
                                    </button>
                                  </>
                                ) : (
                                  <button type="button" onClick={() => handleOpenMessageModal(team)} className="btn btn-primary">쪽지 보내기</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            ) : (
              <StatePanel kind="empty" compact title="조건에 맞는 팀이 없습니다" description="필터를 변경하거나 새 팀 모집글을 등록해 보세요." />
            )}
          </div>
        </section>
      </div>

      {messageModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 60 }}>
          <div style={{ width: "100%", maxWidth: "560px", borderRadius: "24px", background: "#ffffff", border: "1px solid #e5e7eb", boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)", padding: "24px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: 900, color: "#111827" }}>쪽지 보내기</h3>
            <p style={{ margin: "0 0 16px", color: "#4b5563", lineHeight: 1.7 }}>{messageTeamName}{" 팀에 쪽지를 보냅니다."}</p>

            <form onSubmit={handleSendMessage} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>{"제목"}</label>
                <input value={messageTitle} onChange={(e) => setMessageTitle(e.target.value)} placeholder={"제목을 입력해 주세요"} style={{ width: "100%", height: "48px", padding: "0 14px", borderRadius: "14px", border: "1px solid #d1d5db", background: "#fbfcfe" }} />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>{"쪽지 내용"}</label>
                <textarea value={messageContent} onChange={(e) => setMessageContent(e.target.value)} placeholder={"보낼 내용을 입력해 주세요"} rows={5} style={{ width: "100%", padding: "12px 14px", borderRadius: "14px", border: "1px solid #d1d5db", background: "#fbfcfe", resize: "vertical" }} />
              </div>

              {messageError ? (
                <div style={{ borderRadius: "14px", padding: "12px 14px", background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412", fontSize: "14px" }}>{messageError}</div>
              ) : null}

              <div className="inline-actions" style={{ justifyContent: "flex-end" }}>
                <button type="button" onClick={resetMessageForm} className="btn btn-secondary">취소</button>
                <button type="submit" className="btn btn-primary">보내기</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
