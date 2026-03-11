"use client";

import Link from "next/link";
import initialTeams from "../../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  getCurrentSession,
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
      alert("Login is required to create or manage team posts.");
      return;
    }

    if (!name.trim() || !intro.trim() || !contactUrl.trim()) {
      alert("Team name, intro, and contact URL are required.");
      return;
    }

    if (editingTeamCode && !isOwner(editingTeamCode)) {
      alert("Only the team owner can edit this post.");
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
      alert("Team post updated.");
      return;
    }

    const updatedTeams = [nextTeam, ...teams];
    persistTeams(updatedTeams);
    persistOwners({
      ...teamOwners,
      [nextTeamCode]: currentUserId,
    });
    resetForm();
    alert("Team post created.");
  }

  function handleEditTeam(teamCode: string) {
    if (!isOwner(teamCode)) {
      alert("Only the team owner can edit this post.");
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
      alert("Only the team owner can manage this post.");
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

  return (
    <main style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "10px" }}>
          Camp
        </h1>
        <p style={{ color: "#555", lineHeight: 1.6 }}>
          Review team posts, edit your post, and manage recruiting status.
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
          Filter
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
              Hackathon
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
              <option value="">All</option>
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
            Open only
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
            {editingTeamCode ? "Edit team post" : "Create team post"}
          </h2>
          {currentNickname ? (
            <div style={{ color: "#374151", fontWeight: 700 }}>Signed in as {currentNickname}</div>
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
            Login is required to create or manage team posts. <Link href="/auth?mode=login&redirect=/camp" style={{ color: "#2563eb", fontWeight: 800 }}>Open auth</Link>
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
                Team name
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
                Hackathon
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
                Member count
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
                Team status
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
              Looking for
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
              Separate roles with commas.
            </p>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              Intro
            </label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Describe your team and recruiting needs"
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
              Contact URL
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
              {editingTeamCode ? "Save changes" : "Create team post"}
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
                Cancel
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
          <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>Team posts</h2>
          <p style={{ color: "#666" }}>Total {filteredTeams.length}</p>
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
                        <p style={{ color: "#2563eb", fontWeight: 700, margin: 0 }}>Your post</p>
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
                    <strong>Members:</strong> {team.memberCount}
                  </p>

                  <p style={{ marginBottom: "10px", lineHeight: 1.7 }}>
                    <strong>Intro:</strong> {team.intro}
                  </p>

                  <div style={{ marginBottom: "10px" }}>
                    <strong>Looking for</strong>{" "}
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
                      <span>None</span>
                    )}
                  </div>

                  <p style={{ marginBottom: "10px" }}>
                    <strong>Created:</strong> {formatDate(team.createdAt)}
                  </p>

                  <a href={team.contact.url} target="_blank" rel="noreferrer">
                    Open contact
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
                        Edit
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
                        {team.isOpen ? "Close recruitment" : "Reopen recruitment"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <p>No teams match the current filter.</p>
          )}
        </div>
      </section>
    </main>
  );
}
