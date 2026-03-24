"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StatePanel from "../../components/ui/StatePanel";
import hackathonsData from "../../data/public_hackathons.json";
import {
  getHackathonDisplayStatus,
  getHackathonFilterStatusCode,
  type HackathonOverrideStatusCode,
  type HackathonStatusMode,
} from "../../lib/hackathon-status";

type Hackathon = {
  slug: string;
  title: string;
  status: "ended" | "ongoing" | "upcoming";
  statusMode?: HackathonStatusMode;
  statusOverride?: HackathonOverrideStatusCode;
  tags: string[];
  thumbnailUrl: string;
  period: {
    timezone: string;
    startAt: string;
    submissionDeadlineAt: string;
    endAt: string;
  };
  participantCount: number;
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}


function sortHackathons(items: Hackathon[], sort: string) {
  const copied = [...items];

  if (sort === "deadline-asc") {
    return copied.sort(
      (a, b) =>
        new Date(a.period.submissionDeadlineAt).getTime() -
        new Date(b.period.submissionDeadlineAt).getTime()
    );
  }

  if (sort === "deadline-desc") {
    return copied.sort(
      (a, b) =>
        new Date(b.period.submissionDeadlineAt).getTime() -
        new Date(a.period.submissionDeadlineAt).getTime()
    );
  }

  if (sort === "title-asc") {
    return copied.sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }

  return copied;
}

const cardStyle = {
  padding: "18px",
  display: "grid",
  gap: "12px",
} as const;

const topRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
} as const;

const titleStyle = {
  margin: 0,
  fontSize: "20px",
  lineHeight: 1.3,
  fontWeight: 800,
  letterSpacing: "-0.02em",
} as const;

const metaGridStyle = {
  display: "grid",
  gap: "8px",
} as const;

const metaRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "12px",
  color: "#64748b",
  fontSize: "13px",
  lineHeight: 1.6,
} as const;

const tagRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
} as const;

const footerRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  paddingTop: "2px",
} as const;

export default function HackathonsPage() {
  const hackathons = Array.isArray(hackathonsData) ? (hackathonsData as Hackathon[]) : [];
  const hasDataError = !Array.isArray(hackathonsData);

  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortOption, setSortOption] = useState("deadline-asc");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const allTags = useMemo(() => {
    return Array.from(new Set(hackathons.flatMap((item) => item.tags))).sort();
  }, [hackathons]);

  const filteredHackathons = useMemo(() => {
    let result = [...hackathons];

    if (search.trim()) {
      const keyword = search.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(keyword) ||
          item.tags.some((tag) => tag.toLowerCase().includes(keyword))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => getHackathonFilterStatusCode(item, now) === statusFilter);
    }

    if (selectedTag !== "all") {
      result = result.filter((item) => item.tags.includes(selectedTag));
    }

    return sortHackathons(result, sortOption);
  }, [hackathons, now, search, statusFilter, selectedTag, sortOption]);

  return (
    <main className="page-shell">
      <div className="page-stack">
        <section className="page-hero page-hero--dark">
          <span className="eyebrow">Hackathons</span>
          <h1 className="hero-title">참여할 해커톤을 빠르게 찾고 일정과 상태를 비교하세요.</h1>
          <p className="hero-description">상태, 태그, 마감일 기준으로 필요한 해커톤만 바로 추려 볼 수 있습니다.</p>
        </section>

        <section className="form-shell">
          <div className="section-header">
            <div>
              <h2 className="section-title">필터와 정렬</h2>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setSelectedTag("all");
                setSortOption("deadline-asc");
              }}
            >
              필터 초기화
            </button>
          </div>

          <div className="toolbar">
            <div className="field">
              <label htmlFor="hackathon-search">검색</label>
              <input
                id="hackathon-search"
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="해커톤 이름 또는 태그를 입력해 주세요"
              />
            </div>

            <div className="field">
              <label htmlFor="hackathon-status">상태</label>
              <select id="hackathon-status" className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">전체</option>
                <option value="ongoing">진행중</option>
                <option value="scheduled">예정</option>
                <option value="ended">종료</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="hackathon-tag">태그</label>
              <select id="hackathon-tag" className="select" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
                <option value="all">전체</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="hackathon-sort">정렬</label>
              <select id="hackathon-sort" className="select" value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
                <option value="deadline-asc">마감 임박순</option>
                <option value="deadline-desc">마감 여유순</option>
                <option value="title-asc">이름순</option>
              </select>
            </div>
          </div>

          <div className="hero-meta">
            <span>검색 결과 {filteredHackathons.length}개</span>
          </div>
        </section>

        {hasDataError ? (
          <StatePanel
            kind="error"
            title="해커톤 목록을 불러오는 중 문제가 발생했습니다"
            description="목록 데이터를 다시 확인해 주세요"
          />
        ) : filteredHackathons.length === 0 ? (
          <StatePanel
            kind="empty"
            title="조건에 맞는 해커톤이 없습니다"
            description="검색어나 필터 조건을 조정해 다시 확인해 주세요"
          />
        ) : (
          <section className="card-grid">
            {filteredHackathons.map((hackathon) => (
              <Link key={hackathon.slug} href={`/hackathons/${hackathon.slug}`} className="interactive-card">
                <article style={cardStyle}>
                  <div style={topRowStyle}>
                    <span className={getHackathonDisplayStatus(hackathon, now).className}>{getHackathonDisplayStatus(hackathon, now).label}</span>
                    <span className="chip">{hackathon.period.timezone}</span>
                  </div>

                  <div style={metaGridStyle}>
                    <h2 style={titleStyle}>{hackathon.title}</h2>
                    <div style={metaRowStyle}>
                      <span>시작 {formatDate(hackathon.period.startAt)}</span>
                      <span>종료 {formatDate(hackathon.period.endAt)}</span>
                    </div>
                    <div style={metaRowStyle}>
                      <span>제출 마감 {formatDate(hackathon.period.submissionDeadlineAt)}</span>
                      <span>참가자 {hackathon.participantCount}명</span>
                    </div>
                  </div>

                  <div style={tagRowStyle}>
                    {hackathon.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div style={footerRowStyle}>
                    <span className="muted">상세 보기</span>
                    <span className="subtle-link">바로 이동</span>
                  </div>
                </article>
              </Link>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
