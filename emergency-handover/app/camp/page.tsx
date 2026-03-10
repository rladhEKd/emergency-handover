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
      return "Aimers 8기 : 모델 경량화 온라인 해커톤";
    case "monthly-vibe-coding-2026-02":
      return "월간 해커톤 : 바이브 코딩 개선 AI 아이디어 공모전";
    case "daker-handover-2026-03":
      return "긴급 인수인계 해커톤: 명세서만 보고 구현하라";
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

    setTeams(mergedTeams);

    const params = new URLSearchParams(window.location.search);
    const hackathonParam = params.get("hackathon");
    if (hackathonParam) {
      setHackathonFilter(hackathonParam);
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
      alert("팀명, 소개, 연락 링크는 꼭 입력해야 해요.");
      return;
    }

    const newTeam: Team = {
      teamCode: makeTeamCode(),
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

    const updatedTeams = [newTeam, ...teams];
    setTeams(updatedTeams);
    localStorage.setItem("teams", JSON.stringify(updatedTeams));

    setName("");
    setHackathonSlug("daker-handover-2026-03");
    setMemberCount(1);
    setLookingFor("");
    setIntro("");
    setContactUrl("");
    setIsOpen(true);

    alert("팀 모집 글이 등록되었어요!");
  }

  return (
    <main style={{ padding: "40px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "32px" }}>
        <h1 style={{ fontSize: "36px", fontWeight: "bold", marginBottom: "10px" }}>
          팀 찾기
        </h1>
        <p style={{ color: "#555", lineHeight: 1.6 }}>
          해커톤 팀 모집 글을 확인하고, 직접 팀을 만들어 모집할 수 있습니다.
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
            모집중인 팀만 보기
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
          팀 모집 글 작성
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
                팀명
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: vibe-builders"
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
                해커톤
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
                <option value="aimers-8-model-lite">
                  Aimers 8기 : 모델 경량화 온라인 해커톤
                </option>
                <option value="monthly-vibe-coding-2026-02">
                  월간 해커톤 : 바이브 코딩 개선 AI 아이디어 공모전
                </option>
                <option value="daker-handover-2026-03">
                  긴급 인수인계 해커톤: 명세서만 보고 구현하라
                </option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
                현재 인원 수
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
                모집 상태
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
                <option value="open">모집중</option>
                <option value="closed">모집마감</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              찾는 포지션
            </label>
            <input
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              placeholder="예: Frontend, Designer"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
              }}
            />
            <p style={{ marginTop: "6px", color: "#666", fontSize: "14px" }}>
              여러 개는 쉼표(,)로 구분해 입력하세요.
            </p>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
              팀 소개
            </label>
            <textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="팀 방향이나 모집 내용을 적어주세요."
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
              연락 링크
            </label>
            <input
              value={contactUrl}
              onChange={(e) => setContactUrl(e.target.value)}
              placeholder="예: https://open.kakao.com/..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: "20px",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#fff",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            팀 모집 글 등록
          </button>
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
          <h2 style={{ fontSize: "24px", fontWeight: "bold" }}>팀 목록</h2>
          <p style={{ color: "#666" }}>총 {filteredTeams.length}개 팀</p>
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
                      {team.isOpen ? "모집중" : "모집마감"}
                    </span>
                  </div>
                </div>

                <p style={{ marginBottom: "8px" }}>
                  <strong>현재 인원:</strong> {team.memberCount}명
                </p>

                <p style={{ marginBottom: "10px", lineHeight: 1.7 }}>
                  <strong>소개:</strong> {team.intro}
                </p>

                <div style={{ marginBottom: "10px" }}>
                  <strong>찾는 포지션:</strong>{" "}
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
                  <strong>작성일:</strong> {formatDate(team.createdAt)}
                </p>

                <a href={team.contact.url} target="_blank" rel="noreferrer">
                  연락하러 가기
                </a>
              </article>
            ))
          ) : (
            <p>조건에 맞는 팀이 없습니다.</p>
          )}
        </div>
      </section>
    </main>
  );
}