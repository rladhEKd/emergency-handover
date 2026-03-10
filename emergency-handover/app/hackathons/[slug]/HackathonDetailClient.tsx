"use client";

import Link from "next/link";
import { useState } from "react";
import type { Hackathon, DetailHackathon } from "./page";

type TabKey =
  | "overview"
  | "notice"
  | "evaluation"
  | "schedule"
  | "teams"
  | "submit"
  | "leaderboard"
  | "links";

function getStatusText(status: Hackathon["status"]) {
  switch (status) {
    case "ongoing":
      return "진행중";
    case "ended":
      return "종료";
    case "upcoming":
      return "예정";
    default:
      return status;
  }
}

function getStatusStyle(status: Hackathon["status"]) {
  switch (status) {
    case "ongoing":
      return {
        backgroundColor: "#e8f7ea",
        color: "#1f7a35",
      };
    case "ended":
      return {
        backgroundColor: "#f3f4f6",
        color: "#4b5563",
      };
    case "upcoming":
      return {
        backgroundColor: "#eaf2ff",
        color: "#2457c5",
      };
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(amount: number) {
  return amount.toLocaleString("ko-KR") + "원";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderRadius: "14px",
        border: active ? "1px solid #2563eb" : "1px solid #d1d5db",
        background: active ? "#eff6ff" : "#ffffff",
        color: active ? "#2563eb" : "#374151",
        fontWeight: 800,
        fontSize: "14px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "24px",
        padding: "28px",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
      }}
    >
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: "28px",
          fontWeight: 900,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function HackathonDetailClient({
  hackathon,
  details,
}: {
  hackathon: Hackathon;
  details?: DetailHackathon;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const statusStyle = getStatusStyle(hackathon.status);

  return (
    <main
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        padding: "24px 20px 72px",
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <Link
          href="/hackathons"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            color: "#2563eb",
            fontWeight: 800,
            fontSize: "15px",
          }}
        >
          ← 해커톤 목록으로 돌아가기
        </Link>
      </div>

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: "32px",
          padding: "40px 36px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)",
          color: "#ffffff",
          boxShadow: "0 24px 60px rgba(30, 58, 138, 0.22)",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: "-40px",
            top: "-30px",
            width: "220px",
            height: "220px",
            borderRadius: "999px",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: "10px",
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: "16px",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 800,
                background: statusStyle.backgroundColor,
                color: statusStyle.color,
              }}
            >
              {getStatusText(hackathon.status)}
            </span>

            <span
              style={{
                display: "inline-block",
                padding: "8px 12px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                background: "rgba(255,255,255,0.12)",
                color: "#ffffff",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              {hackathon.period.timezone}
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 16px",
              fontSize: "42px",
              lineHeight: 1.18,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              maxWidth: "860px",
            }}
          >
            {hackathon.title}
          </h1>

          <p
            style={{
              margin: "0 0 18px",
              maxWidth: "760px",
              lineHeight: 1.8,
              fontSize: "17px",
              color: "rgba(255,255,255,0.9)",
            }}
          >
            {details?.sections.overview?.summary ??
              "상세 소개 정보가 아직 준비되지 않았습니다."}
          </p>

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
              marginBottom: "18px",
            }}
          >
            {hackathon.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  display: "inline-block",
                  padding: "7px 11px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  color: "#ffffff",
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
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "12px",
            }}
          >
            <div
              style={{
                borderRadius: "18px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                제출 마감
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>
                {formatDate(hackathon.period.submissionDeadlineAt)}
              </div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                종료일
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>
                {formatDate(hackathon.period.endAt)}
              </div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.14)",
              }}
            >
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>
                팀 구성
              </div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>
                최대 {details?.sections.overview?.teamPolicy?.maxTeamSize ?? "-"}명
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "24px",
          padding: "18px",
          boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={activeTab === "notice"} onClick={() => setActiveTab("notice")}>
            Notice
          </TabButton>
          <TabButton active={activeTab === "evaluation"} onClick={() => setActiveTab("evaluation")}>
            Evaluation
          </TabButton>
          <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>
            Schedule
          </TabButton>
          <TabButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")}>
            Teams
          </TabButton>
          <TabButton active={activeTab === "submit"} onClick={() => setActiveTab("submit")}>
            Submit
          </TabButton>
          <TabButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")}>
            Leaderboard
          </TabButton>
          <TabButton active={activeTab === "links"} onClick={() => setActiveTab("links")}>
            Links
          </TabButton>
        </div>
      </section>

      {activeTab === "overview" && (
        <SectionCard title="Overview">
          <p style={{ margin: "0 0 14px", lineHeight: 1.8, color: "#374151" }}>
            {details?.sections.overview?.summary ?? "상세 소개 정보가 없습니다."}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "18px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>
                개인 참가
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900 }}>
                {details?.sections.overview?.teamPolicy?.allowSolo ? "가능" : "불가"}
              </div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "18px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>
                최대 팀 인원
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900 }}>
                {details?.sections.overview?.teamPolicy?.maxTeamSize ?? "-"}명
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "notice" && (
        <SectionCard title="Notice">
          {details?.sections.info?.notice && details.sections.info.notice.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {details.sections.info.notice.map((notice) => (
                <div
                  key={notice}
                  style={{
                    borderRadius: "18px",
                    padding: "16px 18px",
                    background: "#fffaf0",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    lineHeight: 1.7,
                    fontWeight: 600,
                  }}
                >
                  {notice}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>공지 사항이 없습니다.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "evaluation" && (
        <SectionCard title="Evaluation">
          <div style={{ display: "grid", gap: "16px" }}>
            <div
              style={{
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "18px",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>평가 지표</p>
              <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 900 }}>
                {details?.sections.eval?.metricName ?? "-"}
              </h3>
            </div>

            <div
              style={{
                borderRadius: "18px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: "18px",
              }}
            >
              <p style={{ margin: 0, lineHeight: 1.8, color: "#374151" }}>
                {details?.sections.eval?.description ?? "평가 설명이 없습니다."}
              </p>
            </div>

            {details?.sections.eval?.scoreDisplay?.breakdown &&
              details.sections.eval.scoreDisplay.breakdown.length > 0 && (
                <div>
                  <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>
                    점수 구성
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                      gap: "14px",
                    }}
                  >
                    {details.sections.eval.scoreDisplay.breakdown.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          borderRadius: "18px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          padding: "18px",
                        }}
                      >
                        <div style={{ fontSize: "14px", color: "#2563eb", marginBottom: "8px" }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: "26px", fontWeight: 900, color: "#1d4ed8" }}>
                          {item.weightPercent}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {details?.sections.eval?.limits && (
              <div>
                <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>
                  제한 조건
                </h3>
                <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: 1.9, color: "#374151" }}>
                  {details.sections.eval.limits.maxRuntimeSec && (
                    <li>최대 실행 시간: {details.sections.eval.limits.maxRuntimeSec}초</li>
                  )}
                  {details.sections.eval.limits.maxSubmissionsPerDay && (
                    <li>일일 최대 제출 횟수: {details.sections.eval.limits.maxSubmissionsPerDay}회</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === "schedule" && (
        <SectionCard title="Schedule">
          {details?.sections.schedule?.milestones &&
          details.sections.schedule.milestones.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {details.sections.schedule.milestones.map((milestone) => (
                <div
                  key={`${milestone.name}-${milestone.at}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "16px",
                    flexWrap: "wrap",
                    alignItems: "center",
                    borderRadius: "18px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#111827" }}>{milestone.name}</div>
                  <div style={{ color: "#6b7280", fontWeight: 700 }}>{formatDate(milestone.at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>일정 정보가 없습니다.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "teams" && (
        <SectionCard title="Teams">
          <p style={{ margin: "0 0 14px", color: "#374151", lineHeight: 1.8 }}>
            해당 해커톤과 연결된 팀 모집 기능을 이용할 수 있습니다.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "18px",
              }}
            >
              <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>
                팀 모집 페이지 사용
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900 }}>
                {details?.sections.teams?.campEnabled ? "가능" : "불가"}
              </div>
            </div>

            <div
              style={{
                borderRadius: "18px",
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                padding: "18px",
                display: "flex",
                alignItems: "center",
              }}
            >
              {details?.sections.teams?.listUrl ? (
                <Link
                  href={details.sections.teams.listUrl}
                  style={{
                    color: "#2563eb",
                    fontWeight: 800,
                    fontSize: "15px",
                  }}
                >
                  팀 모집 보러 가기 →
                </Link>
              ) : (
                <span style={{ color: "#6b7280" }}>연결된 팀 모집 링크가 없습니다.</span>
              )}
            </div>
          </div>
        </SectionCard>
      )}

      {activeTab === "submit" && (
        <SectionCard title="Submit">
          {details?.sections.submit?.guide && details.sections.submit.guide.length > 0 ? (
            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              {details.sections.submit.guide.map((guide) => (
                <div
                  key={guide}
                  style={{
                    borderRadius: "18px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "16px 18px",
                    color: "#374151",
                    lineHeight: 1.7,
                  }}
                >
                  {guide}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0 0 14px", color: "#6b7280" }}>제출 안내가 없습니다.</p>
          )}

          {details?.sections.submit?.allowedArtifactTypes &&
            details.sections.submit.allowedArtifactTypes.length > 0 && (
              <div style={{ marginBottom: "16px" }}>
                <h3 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 900 }}>
                  허용 제출 형식
                </h3>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {details.sections.submit.allowedArtifactTypes.map((type) => (
                    <span
                      key={type}
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        background: "#eef4ff",
                        color: "#2457c5",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    >
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            )}

          {details?.sections.submit?.submissionItems &&
            details.sections.submit.submissionItems.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 900 }}>
                  제출 항목
                </h3>
                <div style={{ display: "grid", gap: "12px" }}>
                  {details.sections.submit.submissionItems.map((item) => (
                    <div
                      key={item.key}
                      style={{
                        borderRadius: "18px",
                        background: "#ffffff",
                        border: "1px solid #e5e7eb",
                        padding: "16px 18px",
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: "6px" }}>{item.title}</div>
                      <div style={{ color: "#6b7280", fontSize: "14px" }}>{item.format}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </SectionCard>
      )}

      {activeTab === "leaderboard" && (
        <SectionCard title="Leaderboard">
          <p style={{ margin: "0 0 16px", color: "#374151", lineHeight: 1.8 }}>
            {details?.sections.leaderboard?.note ?? "리더보드 안내가 없습니다."}
          </p>

          {details?.sections.leaderboard?.publicLeaderboardUrl ? (
            <Link
              href={details.sections.leaderboard.publicLeaderboardUrl}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: "14px",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 800,
              }}
            >
              리더보드 바로가기
            </Link>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>리더보드 링크가 없습니다.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "links" && (
        <SectionCard title="Links">
          <div style={{ display: "grid", gap: "12px" }}>
            {details?.sections.info?.links?.rules && (
              <a
                href={details.sections.info.links.rules}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  borderRadius: "18px",
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  padding: "16px 18px",
                  fontWeight: 800,
                  color: "#2563eb",
                }}
              >
                규칙 보기 →
              </a>
            )}

            {details?.sections.info?.links?.faq && (
              <a
                href={details.sections.info.links.faq}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "block",
                  borderRadius: "18px",
                  background: "#f8fafc",
                  border: "1px solid #e5e7eb",
                  padding: "16px 18px",
                  fontWeight: 800,
                  color: "#2563eb",
                }}
              >
                FAQ 보기 →
              </a>
            )}
          </div>
        </SectionCard>
      )}
    </main>
  );
}