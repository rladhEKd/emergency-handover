"use client";

import initialTeams from "../../data/public_teams.json";
import { useEffect, useMemo, useState } from "react";

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

  function persistTeams(nextTeams: Team[]) {
    setTeams(nextTeams);
    localStorage.setItem("teams", JSON.stringify(nextTeams));
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

    const params = new URLSearchParams(window.location.search);
    const hackathonParam = params.get("hackathon");
    if (hackathonParam) {
      window.requestAnimationFrame(() => setHackathonFilter(hackathonParam));
    }
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

  function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim() || !intro.trim() || !contactUrl.trim()) {
      alert("Team name, intro, and contact URL are required.");
      return;
    }

    const nextTeam: Team = {
      teamCode: editingTeamCode || makeTeamCode(),
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
    resetForm();
    alert("Team post created.");
  }

  function handleEditTeam(teamCode: string) {
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
        <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
          {editingTeamCode ? "Edit team post" : "Create team post"}
        </h2>

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
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
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
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
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
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
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
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #ccc",
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
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
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
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                resize: "vertical",
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
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <div style={{ marginTop: "20px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="submit"
              style={{
                padding: "12px 18px",
                borderRadius: "10px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#fff",
                fontWeight: "bold",
                cursor: "pointer",
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
            filteredTeams.map((team) => (
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
              </article>
            ))
          ) : (
            <p>No teams match the current filter.</p>
          )}
        </div>
      </section>
    </main>
  );
}
