"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import hackathonsData from "../../data/public_hackathons.json";

type Hackathon = {
  slug: string;
  title: string;
  status: "ended" | "ongoing" | "upcoming";
  tags: string[];
  thumbnailUrl: string;
  period: {
    timezone: string;
    submissionDeadlineAt: string;
    endAt: string;
  };
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getStatusLabel(status: Hackathon["status"]) {
  if (status === "ongoing") return "진행중";
  if (status === "upcoming") return "예정";
  return "종료";
}

function getStatusStyle(status: Hackathon["status"]) {
  if (status === "ongoing") {
    return {
      backgroundColor: "#e8f7ea",
      color: "#1f7a35",
    };
  }
  if (status === "upcoming") {
    return {
      backgroundColor: "#eaf2ff",
      color: "#2457c5",
    };
  }
  return {
    backgroundColor: "#f3f4f6",
    color: "#4b5563",
  };
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

export default function HackathonsPage() {
  const hackathons = hackathonsData as Hackathon[];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [sortOption, setSortOption] = useState("deadline-asc");

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
      result = result.filter((item) => item.status === statusFilter);
    }

    if (selectedTag !== "all") {
      result = result.filter((item) => item.tags.includes(selectedTag));
    }

    return sortHackathons(result, sortOption);
  }, [hackathons, search, statusFilter, selectedTag, sortOption]);

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "24px 20px 72px",
      }}
    >
      <section
        style={{
          borderRadius: "28px",
          padding: "36px 32px",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
          border: "1px solid #e5e7eb",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.05)",
          marginBottom: "24px",
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: "13px",
            fontWeight: 800,
            color: "#2563eb",
            letterSpacing: "0.04em",
          }}
        >
          해커톤 목록
        </p>

        <h1
          style={{
            margin: "0 0 12px",
            fontSize: "40px",
            lineHeight: 1.15,
            fontWeight: 900,
            letterSpacing: "-0.03em",
          }}
        >
          해커톤 둘러보기
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: "720px",
            color: "#6b7280",
            lineHeight: 1.7,
            fontSize: "16px",
          }}
        >
          진행중, 예정, 종료된 해커톤을 한눈에 확인하고 상태와 태그 기준으로 빠르게 찾아보세요.
        </p>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "24px",
          padding: "22px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr",
            gap: "14px",
            alignItems: "end",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              검색
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="해커톤 이름 또는 태그 검색"
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                outline: "none",
                fontSize: "15px",
                background: "#fbfcfe",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                background: "#fbfcfe",
                fontSize: "15px",
              }}
            >
              <option value="all">전체</option>
              <option value="ongoing">진행중</option>
              <option value="upcoming">예정</option>
              <option value="ended">종료</option>
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              태그
            </label>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                background: "#fbfcfe",
                fontSize: "15px",
              }}
            >
              <option value="all">전체</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              정렬
            </label>
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
              style={{
                width: "100%",
                height: "48px",
                padding: "0 14px",
                borderRadius: "14px",
                border: "1px solid #d1d5db",
                background: "#fbfcfe",
                fontSize: "15px",
              }}
            >
              <option value="deadline-asc">마감 임박순</option>
              <option value="deadline-desc">마감 여유순</option>
              <option value="title-asc">이름순</option>
            </select>
          </div>
        </div>

        <div
          style={{
            marginTop: "18px",
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <p
            style={{
              margin: 0,
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            총 <strong style={{ color: "#111827" }}>{filteredHackathons.length}</strong>개의 해커톤이 검색되었습니다.
          </p>

          <button
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setSelectedTag("all");
              setSortOption("deadline-asc");
            }}
            style={{
              border: "1px solid #d1d5db",
              background: "#ffffff",
              color: "#374151",
              borderRadius: "12px",
              padding: "10px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            필터 초기화
          </button>
        </div>
      </section>

      {filteredHackathons.length === 0 ? (
        <section
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "24px",
            padding: "48px 24px",
            textAlign: "center",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
          }}
        >
          <div
            style={{
              fontSize: "42px",
              marginBottom: "12px",
            }}
          >
            검색
          </div>
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: "24px",
              fontWeight: 900,
            }}
          >
            검색 결과가 없습니다
          </h2>
          <p
            style={{
              margin: 0,
              color: "#6b7280",
              lineHeight: 1.7,
            }}
          >
            검색어 또는 필터 조건을 바꿔서 다시 확인해 주세요.
          </p>
        </section>
      ) : (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "20px",
          }}
        >
          {filteredHackathons.map((hackathon) => (
            <Link key={hackathon.slug} href={`/hackathons/${hackathon.slug}`}>
              <article
                style={{
                  background: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "24px",
                  padding: "24px",
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
                  minHeight: "220px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "12px",
                      alignItems: "center",
                      marginBottom: "14px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        padding: "7px 11px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 800,
                        ...getStatusStyle(hackathon.status),
                      }}
                    >
                      {getStatusLabel(hackathon.status)}
                    </span>

                    <span
                      style={{
                        color: "#6b7280",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {hackathon.period.timezone}
                    </span>
                  </div>

                  <h2
                    style={{
                      margin: "0 0 14px",
                      fontSize: "26px",
                      lineHeight: 1.35,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {hackathon.title}
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginBottom: "16px",
                    }}
                  >
                    {hackathon.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-block",
                          padding: "7px 11px",
                          borderRadius: "999px",
                          background: "#eef4ff",
                          color: "#2457c5",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      제출 마감: {formatDate(hackathon.period.submissionDeadlineAt)}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        color: "#6b7280",
                        fontSize: "14px",
                      }}
                    >
                      종료일: {formatDate(hackathon.period.endAt)}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "22px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span
                    style={{
                      color: "#6b7280",
                      fontSize: "14px",
                    }}
                  >
                    상세 페이지로 이동
                  </span>

                  <span
                    style={{
                      color: "#2563eb",
                      fontWeight: 800,
                      fontSize: "15px",
                    }}
                  >
                    자세히 보기
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
