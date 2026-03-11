"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import leaderboardData from "../../../data/public_leaderboard.json";
import initialTeams from "../../../data/public_teams.json";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../../../lib/local-auth";
import type { DetailHackathon, Hackathon } from "./page";

type TabKey =
  | "overview"
  | "evaluation"
  | "schedule"
  | "prize"
  | "teams"
  | "submit"
  | "leaderboard";

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

type LeaderboardEntry = {
  rank: number;
  teamName: string;
  score: number;
  submittedAt: string;
  scoreBreakdown?: {
    participant?: number;
    judge?: number;
  };
};

type Leaderboard = {
  hackathonSlug: string;
  updatedAt: string;
  entries: LeaderboardEntry[];
};

type LeaderboardData = Leaderboard & {
  extraLeaderboards?: Leaderboard[];
};

type SubmissionItem = {
  key: string;
  title: string;
  format: string;
};

type SubmissionRecord = {
  id: string;
  hackathonSlug: string;
  submittedAt: string;
  notes: string;
  values: Record<string, string>;
};

type TeamJoinStatus = "pending" | "accepted" | "rejected";

type TeamJoinRequest = {
  teamCode: string;
  requesterId: string;
  requesterName: string;
  status: TeamJoinStatus;
  createdAt: string;
  respondedAt?: string;
};

type PendingTeamAction =
  | { type: "navigate"; url: string }
  | { type: "request"; teamCode: string }
  | { type: "review"; teamCode: string; requesterId: string; nextStatus: Exclude<TeamJoinStatus, "pending"> };

const SUBMISSION_STORAGE_PREFIX = "hackathon-submissions-v1";
const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1";

function getStatusText(status: Hackathon["status"]) {
  switch (status) {
    case "ongoing":
      return "Ongoing";
    case "ended":
      return "Ended";
    case "upcoming":
      return "Upcoming";
    default:
      return status;
  }
}

function getStatusStyle(status: Hackathon["status"]) {
  switch (status) {
    case "ongoing":
      return { backgroundColor: "#e8f7ea", color: "#1f7a35" };
    case "ended":
      return { backgroundColor: "#f3f4f6", color: "#4b5563" };
    case "upcoming":
      return { backgroundColor: "#eaf2ff", color: "#2457c5" };
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

function formatMoney(amountKRW: number) {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amountKRW);
}

function safeScore(score: number) {
  if (score >= 1 && Number.isInteger(score)) return score.toString();
  if (score >= 1) return score.toFixed(1);
  return score.toFixed(4);
}

function getSubmissionStorageKey(slug: string, userId: string) {
  return `${SUBMISSION_STORAGE_PREFIX}:${slug}:${userId}`;
}

function getTeamJoinRequestsStorageKey(slug: string) {
  return `${TEAM_JOIN_REQUESTS_PREFIX}:${slug}`;
}

function makeInitialSubmissionValues(items: SubmissionItem[]) {
  return items.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = "";
    return acc;
  }, {});
}

function isUrlFormat(format: string) {
  return format === "url" || format === "pdf_url";
}

function isValidUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getInputPlaceholder(format: string) {
  if (isUrlFormat(format)) return "https://example.com";
  if (format === "text_or_url") return "Enter text or paste a URL";
  return "Enter text";
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode; }) {
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode; }) {
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
      <h2 style={{ margin: "0 0 18px", fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em" }}>{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "blue"; }) {
  const palette = tone === "blue"
    ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
    : { background: "#f8fafc", border: "#e5e7eb", color: "#111827" };

  return (
    <div style={{ borderRadius: "18px", background: palette.background, border: `1px solid ${palette.border}`, padding: "18px" }}>
      <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: 900, color: palette.color }}>{value}</div>
    </div>
  );
}

export default function HackathonDetailClient({ hackathon, details }: { hackathon: Hackathon; details?: DetailHackathon; }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [teams, setTeams] = useState<Team[]>(initialTeams as Team[]);
  const statusStyle = getStatusStyle(hackathon.status);

  useEffect(() => {
    const fallbackTeams = initialTeams as Team[];

    function syncAuthState() {
      const session = getCurrentSession();
      setCurrentUserId(session?.userId ?? "");
      setCurrentNickname(session?.nickname ?? "");
    }

    try {
      const savedTeams = window.localStorage.getItem("teams");
      if (!savedTeams) {
        setTeams(fallbackTeams);
      } else {
        const parsedTeams = JSON.parse(savedTeams) as Team[];
        setTeams(Array.isArray(parsedTeams) ? parsedTeams : fallbackTeams);
      }
    } catch {
      setTeams(fallbackTeams);
    }

    syncAuthState();
    setTeamOwners(getTeamOwners());
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuthState);
      window.removeEventListener("storage", syncAuthState);
    };
  }, []);

  const leaderboard = useMemo(() => {
    const data = leaderboardData as LeaderboardData;
    const boards: Leaderboard[] = [
      { hackathonSlug: data.hackathonSlug, updatedAt: data.updatedAt, entries: data.entries },
      ...(data.extraLeaderboards ?? []),
    ];
    return boards.find((board) => board.hackathonSlug === hackathon.slug);
  }, [hackathon.slug]);

  const hackathonTeams = useMemo(
    () => teams
      .filter((team) => team.hackathonSlug === hackathon.slug)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [hackathon.slug, teams]
  );

  const openTeams = useMemo(() => hackathonTeams.filter((team) => team.isOpen), [hackathonTeams]);
  const leaderboardPreview = leaderboard?.entries.slice(0, 3) ?? [];
  const maxTeamSize = details?.sections.overview?.teamPolicy?.maxTeamSize ?? "-";
  const allowSolo = details?.sections.overview?.teamPolicy?.allowSolo;
  const quickLinks = details?.sections.info?.links;
  const notices = details?.sections.info?.notice ?? [];
  const submissionItems = useMemo(
    () => (details?.sections.submit?.submissionItems ?? []) as SubmissionItem[],
    [details]
  );
  const [submissionValues, setSubmissionValues] = useState<Record<string, string>>({});
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionRecord[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentNickname, setCurrentNickname] = useState("");
  const [teamActionModalOpen, setTeamActionModalOpen] = useState(false);
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(null);
  const [teamOwners, setTeamOwners] = useState<Record<string, string>>({});
  const [teamJoinRequests, setTeamJoinRequests] = useState<TeamJoinRequest[]>([]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(getTeamJoinRequestsStorageKey(hackathon.slug));
      if (!stored) {
        setTeamJoinRequests([]);
        return;
      }

      const parsed = JSON.parse(stored) as TeamJoinRequest[];
      setTeamJoinRequests(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTeamJoinRequests([]);
    }
  }, [hackathon.slug]);

  useEffect(() => {
    const initialValues = makeInitialSubmissionValues(submissionItems);
    setSubmissionValues(initialValues);
    setSubmissionNotes("");
    setSubmitError("");
    setSubmitSuccess("");

    if (!currentUserId) {
      setSubmissionHistory([]);
      return;
    }

    try {
      const stored = window.localStorage.getItem(getSubmissionStorageKey(hackathon.slug, currentUserId));
      if (!stored) {
        setSubmissionHistory([]);
        return;
      }

      const parsed = JSON.parse(stored) as SubmissionRecord[];
      setSubmissionHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSubmissionHistory([]);
    }
  }, [currentUserId, hackathon.slug, submissionItems]);

  function handleSubmissionValueChange(key: string, value: string) {
    setSubmissionValues((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function persistTeamJoinRequests(nextRequests: TeamJoinRequest[]) {
    setTeamJoinRequests(nextRequests);
    window.localStorage.setItem(
      getTeamJoinRequestsStorageKey(hackathon.slug),
      JSON.stringify(nextRequests)
    );
  }

  function handleTeamActionStart(action: PendingTeamAction) {
    setPendingTeamAction(action);
    setTeamActionModalOpen(true);
  }

  function handleTeamActionCancel() {
    setTeamActionModalOpen(false);
    setPendingTeamAction(null);
  }

  function handleTeamActionConfirm() {
    if (!pendingTeamAction) {
      setTeamActionModalOpen(false);
      return;
    }

    if (pendingTeamAction.type === "navigate") {
      router.push(pendingTeamAction.url);
    }

    if (pendingTeamAction.type === "request") {
      if (currentUserId) {
        const existing = teamJoinRequests.find(
          (request) => request.teamCode === pendingTeamAction.teamCode && request.requesterId === currentUserId
        );

        if (!existing) {
          persistTeamJoinRequests([
            {
              teamCode: pendingTeamAction.teamCode,
              requesterId: currentUserId,
              requesterName: currentNickname || "Member",
              status: "pending",
              createdAt: new Date().toISOString(),
            },
            ...teamJoinRequests,
          ]);
        }
      }
    }

    if (pendingTeamAction.type === "review") {
      const nextRequests = teamJoinRequests.map((request) =>
        request.teamCode === pendingTeamAction.teamCode && request.requesterId === pendingTeamAction.requesterId
          ? {
              ...request,
              status: pendingTeamAction.nextStatus,
              respondedAt: new Date().toISOString(),
            }
          : request
      );
      persistTeamJoinRequests(nextRequests);
    }

    setTeamActionModalOpen(false);
    setPendingTeamAction(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!currentUserId) {
      setSubmitError("Login is required to save a submission.");
      setSubmitSuccess("");
      return;
    }

    if (submissionItems.length === 0) {
      setSubmitError("No submission items are configured for this hackathon.");
      setSubmitSuccess("");
      return;
    }

    for (const item of submissionItems) {
      const rawValue = submissionValues[item.key] ?? "";
      const value = rawValue.trim();

      if (!value) {
        setSubmitError(`Please fill in ${item.title}.`);
        setSubmitSuccess("");
        return;
      }

      if (isUrlFormat(item.format) && !isValidUrl(value)) {
        setSubmitError(`Please enter a valid URL for ${item.title}.`);
        setSubmitSuccess("");
        return;
      }
    }

    const record: SubmissionRecord = {
      id: `${hackathon.slug}-${Date.now()}`,
      hackathonSlug: hackathon.slug,
      submittedAt: new Date().toISOString(),
      notes: submissionNotes.trim(),
      values: submissionItems.reduce<Record<string, string>>((acc, item) => {
        acc[item.key] = (submissionValues[item.key] ?? "").trim();
        return acc;
      }, {}),
    };

    const updatedHistory = [record, ...submissionHistory];
    window.localStorage.setItem(
      getSubmissionStorageKey(hackathon.slug, currentUserId),
      JSON.stringify(updatedHistory)
    );
    setSubmissionHistory(updatedHistory);
    setSubmissionValues(makeInitialSubmissionValues(submissionItems));
    setSubmissionNotes("");
    setSubmitError("");
    setSubmitSuccess("Submission saved locally.");
  }

  const authRedirectUrl = `/auth?mode=login&redirect=/hackathons/${hackathon.slug}`;

  function getMyJoinRequest(teamCode: string) {
    if (!currentUserId) return null;
    return (
      teamJoinRequests.find(
        (request) => request.teamCode === teamCode && request.requesterId === currentUserId
      ) ?? null
    );
  }

  function getTeamRequestsForOwner(teamCode: string) {
    return teamJoinRequests
      .filter((request) => request.teamCode === teamCode)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  function isTeamOwner(teamCode: string) {
    return !!currentUserId && teamOwners[teamCode] === currentUserId;
  }

  return (
    <main style={{ maxWidth: "1180px", margin: "0 auto", padding: "24px 20px 72px" }}>
      <div style={{ marginBottom: "18px" }}>
        <Link href="/hackathons" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#2563eb", fontWeight: 800, fontSize: "15px" }}>
          Back to hackathons
        </Link>
      </div>

      <section style={{ position: "relative", overflow: "hidden", borderRadius: "32px", padding: "40px 36px", background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #3b82f6 100%)", color: "#ffffff", boxShadow: "0 24px 60px rgba(30, 58, 138, 0.22)", marginBottom: "24px" }}>
        <div style={{ position: "absolute", right: "-40px", top: "-30px", width: "220px", height: "220px", borderRadius: "999px", background: "rgba(255,255,255,0.08)" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 800, background: statusStyle.backgroundColor, color: statusStyle.color }}>{getStatusText(hackathon.status)}</span>
            <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", fontSize: "13px", fontWeight: 700, background: "rgba(255,255,255,0.12)", color: "#ffffff", border: "1px solid rgba(255,255,255,0.16)" }}>{hackathon.period.timezone}</span>
          </div>

          <h1 style={{ margin: "0 0 16px", fontSize: "42px", lineHeight: 1.18, fontWeight: 900, letterSpacing: "-0.03em", maxWidth: "860px" }}>{hackathon.title}</h1>
          <p style={{ margin: "0 0 18px", maxWidth: "760px", lineHeight: 1.8, fontSize: "17px", color: "rgba(255,255,255,0.9)" }}>{details?.sections.overview?.summary ?? "Overview details are not available yet."}</p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
            {hackathon.tags.map((tag) => (
              <span key={tag} style={{ display: "inline-block", padding: "7px 11px", borderRadius: "999px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", color: "#ffffff", fontSize: "12px", fontWeight: 700 }}>#{tag}</span>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
            <div style={{ borderRadius: "18px", padding: "16px 18px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>Submission deadline</div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>{formatDate(hackathon.period.submissionDeadlineAt)}</div>
            </div>
            <div style={{ borderRadius: "18px", padding: "16px 18px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>End date</div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>{formatDate(hackathon.period.endAt)}</div>
            </div>
            <div style={{ borderRadius: "18px", padding: "16px 18px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <div style={{ fontSize: "12px", opacity: 0.82, marginBottom: "6px" }}>Team size</div>
              <div style={{ fontSize: "18px", fontWeight: 900 }}>Up to {maxTeamSize}</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "24px", padding: "18px", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)", marginBottom: "24px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>Overview</TabButton>
          <TabButton active={activeTab === "evaluation"} onClick={() => setActiveTab("evaluation")}>Evaluation</TabButton>
          <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>Schedule</TabButton>
          <TabButton active={activeTab === "prize"} onClick={() => setActiveTab("prize")}>Prize</TabButton>
          <TabButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")}>Teams</TabButton>
          <TabButton active={activeTab === "submit"} onClick={() => setActiveTab("submit")}>Submit</TabButton>
          <TabButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")}>Leaderboard</TabButton>
        </div>
      </section>
      {activeTab === "overview" && (
        <SectionCard title="Overview">
          <p style={{ margin: "0 0 14px", lineHeight: 1.8, color: "#374151" }}>
            {details?.sections.overview?.summary ?? "Detailed overview is not available yet."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px", marginBottom: notices.length > 0 || quickLinks ? "18px" : 0 }}>
            <StatCard label="Solo participation" value={allowSolo ? "Allowed" : "Team only"} />
            <StatCard label="Max team size" value={maxTeamSize} />
          </div>

          {notices.length > 0 && (
            <div style={{ display: "grid", gap: "12px", marginBottom: quickLinks ? "18px" : 0 }}>
              {notices.map((notice) => (
                <div key={notice} style={{ borderRadius: "18px", padding: "16px 18px", background: "#fffaf0", border: "1px solid #fde68a", color: "#92400e", lineHeight: 1.7, fontWeight: 600 }}>
                  {notice}
                </div>
              ))}
            </div>
          )}

          {quickLinks && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
              {quickLinks.rules && (
                <a href={quickLinks.rules} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px 18px", fontWeight: 800, color: "#2563eb" }}>
                  View rules
                </a>
              )}
              {quickLinks.faq && (
                <a href={quickLinks.faq} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px 18px", fontWeight: 800, color: "#2563eb" }}>
                  View FAQ
                </a>
              )}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === "evaluation" && (
        <SectionCard title="Evaluation">
          <div style={{ display: "grid", gap: "16px" }}>
            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px" }}>
              <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>Metric</p>
              <h3 style={{ margin: 0, fontSize: "24px", fontWeight: 900 }}>{details?.sections.eval?.metricName ?? "-"}</h3>
            </div>

            <div style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}>
              <p style={{ margin: 0, lineHeight: 1.8, color: "#374151" }}>{details?.sections.eval?.description ?? "Evaluation details are not available yet."}</p>
            </div>

            {details?.sections.eval?.scoreDisplay?.breakdown && details.sections.eval.scoreDisplay.breakdown.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>Score breakdown</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "14px" }}>
                  {details.sections.eval.scoreDisplay.breakdown.map((item) => (
                    <div key={item.key} style={{ borderRadius: "18px", background: "#eff6ff", border: "1px solid #bfdbfe", padding: "18px" }}>
                      <div style={{ fontSize: "14px", color: "#2563eb", marginBottom: "8px" }}>{item.label}</div>
                      <div style={{ fontSize: "26px", fontWeight: 900, color: "#1d4ed8" }}>{item.weightPercent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {details?.sections.eval?.limits && (
              <div>
                <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>Limits</h3>
                <ul style={{ margin: 0, paddingLeft: "20px", lineHeight: 1.9, color: "#374151" }}>
                  {details.sections.eval.limits.maxRuntimeSec && <li>Maximum runtime: {details.sections.eval.limits.maxRuntimeSec} sec</li>}
                  {details.sections.eval.limits.maxSubmissionsPerDay && <li>Daily submission cap: {details.sections.eval.limits.maxSubmissionsPerDay}</li>}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {activeTab === "schedule" && (
        <SectionCard title="Schedule">
          {details?.sections.schedule?.milestones && details.sections.schedule.milestones.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {details.sections.schedule.milestones.map((milestone) => (
                <div key={`${milestone.name}-${milestone.at}`} style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center", borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px 18px" }}>
                  <div style={{ fontWeight: 800, color: "#111827" }}>{milestone.name}</div>
                  <div style={{ color: "#6b7280", fontWeight: 700 }}>{formatDate(milestone.at)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>Schedule information is not available.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "prize" && (
        <SectionCard title="Prize">
          {details?.sections.prize?.items && details.sections.prize.items.length > 0 ? (
            <div style={{ display: "grid", gap: "12px" }}>
              {details.sections.prize.items.map((item) => (
                <div key={`${item.place}-${item.amountKRW}`} style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", alignItems: "center", borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px" }}>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "#111827" }}>{item.place}</div>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "#2563eb" }}>{formatMoney(item.amountKRW)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>Prize information is not available yet.</p>
          )}
        </SectionCard>
      )}
      {activeTab === "teams" && (
        <SectionCard title="Teams">
          <p style={{ margin: "0 0 14px", color: "#374151", lineHeight: 1.8 }}>
            Team formation for this hackathon is managed through the camp board. You can review the current team status before moving to the recruiting page.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginBottom: "18px" }}>
            <StatCard label="Camp board" value={details?.sections.teams?.campEnabled ? "Open" : "Off"} />
            <StatCard label="Solo allowed" value={allowSolo ? "Yes" : "No"} />
            <StatCard label="Max size" value={maxTeamSize} />
            <StatCard label="Open teams" value={openTeams.length} tone="blue" />
          </div>

          {openTeams.length > 0 ? (
            <div style={{ display: "grid", gap: "12px", marginBottom: "18px" }}>
              {openTeams.slice(0, 3).map((team) => {
                const isOwner = isTeamOwner(team.teamCode);
                const myJoinRequest = getMyJoinRequest(team.teamCode);
                const ownerRequests = getTeamRequestsForOwner(team.teamCode);

                return (
                <article key={team.teamCode} style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                    <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900 }}>{team.name}</h3>
                    <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#e8f7ea", color: "#1e7a35", fontWeight: 800, fontSize: "13px" }}>Recruiting</span>
                  </div>
                  <p style={{ margin: "0 0 10px", color: "#374151", lineHeight: 1.7 }}>{team.intro}</p>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {team.lookingFor.length > 0 ? (
                      team.lookingFor.map((role) => (
                        <span key={role} style={{ display: "inline-block", padding: "7px 11px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontSize: "12px", fontWeight: 700 }}>{role}</span>
                      ))
                    ) : (
                      <span style={{ color: "#6b7280", fontSize: "14px" }}>No role tags</span>
                    )}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "12px" }}>{team.memberCount} members now - Posted {formatDate(team.createdAt)}</div>

                  {isOwner ? (
                    <div style={{ display: "grid", gap: "10px" }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>Join requests</div>
                      {ownerRequests.length > 0 ? (
                        ownerRequests.map((request) => (
                          <div key={`${request.teamCode}-${request.requesterId}`} style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: request.status === "pending" ? "10px" : 0 }}>
                              <div>
                                <div style={{ fontWeight: 800, color: "#111827" }}>{request.requesterName}</div>
                                <div style={{ color: "#6b7280", fontSize: "13px" }}>Requested {formatDate(request.createdAt)}</div>
                              </div>
                              <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: request.status === "accepted" ? "#e8f7ea" : request.status === "rejected" ? "#f3f4f6" : "#eef4ff", color: request.status === "accepted" ? "#1e7a35" : request.status === "rejected" ? "#4b5563" : "#2457c5", fontWeight: 800, fontSize: "12px" }}>
                                {request.status === "pending" ? "Pending" : request.status === "accepted" ? "Accepted" : "Rejected"}
                              </span>
                            </div>
                            {request.status === "pending" ? (
                              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={() => handleTeamActionStart({ type: "review", teamCode: team.teamCode, requesterId: request.requesterId, nextStatus: "accepted" })}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: "10px",
                                    border: "none",
                                    background: "#2563eb",
                                    color: "#ffffff",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  Accept
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleTeamActionStart({ type: "review", teamCode: team.teamCode, requesterId: request.requesterId, nextStatus: "rejected" })}
                                  style={{
                                    padding: "10px 14px",
                                    borderRadius: "10px",
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    color: "#374151",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px", color: "#6b7280" }}>
                          No join requests yet.
                        </div>
                      )}
                    </div>
                  ) : myJoinRequest?.status === "accepted" ? (
                    <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#e8f7ea", color: "#1e7a35", fontWeight: 800, fontSize: "13px" }}>
                      Joined
                    </span>
                  ) : myJoinRequest?.status === "rejected" ? (
                    <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#f3f4f6", color: "#4b5563", fontWeight: 800, fontSize: "13px" }}>
                      Rejected
                    </span>
                  ) : myJoinRequest?.status === "pending" ? (
                    <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontWeight: 800, fontSize: "13px" }}>
                      Pending
                    </span>
                  ) : currentUserId ? (
                    <button
                      type="button"
                      onClick={() => handleTeamActionStart({ type: "request", teamCode: team.teamCode })}
                      style={{
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "none",
                        background: "#2563eb",
                        color: "#ffffff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Request to join
                    </button>
                  ) : (
                    <Link href={authRedirectUrl} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: "10px", background: "#2563eb", color: "#ffffff", fontWeight: 800, textDecoration: "none" }}>
                      Login to join
                    </Link>
                  )}
                </article>
                );
              })}
            </div>
          ) : (
            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px", marginBottom: "18px", color: "#6b7280" }}>
              There are no open team posts for this hackathon yet.
            </div>
          )}

          {details?.sections.teams?.listUrl ? (
            <button
              type="button"
              onClick={() => handleTeamActionStart({ type: "navigate", url: details.sections.teams!.listUrl! })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                borderRadius: "14px",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 800,
                border: "none",
                cursor: "pointer",
              }}
            >
              Open team board
            </button>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>No linked camp board is configured.</p>
          )}
        </SectionCard>
      )}

      {activeTab === "submit" && (
        <SectionCard title="Submit">
          {details?.sections.submit?.guide && details.sections.submit.guide.length > 0 ? (
            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              {details.sections.submit.guide.map((guide) => (
                <div key={guide} style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "16px 18px", color: "#374151", lineHeight: 1.7 }}>
                  {guide}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: "0 0 14px", color: "#6b7280" }}>Submission guide is not available.</p>
          )}

          {details?.sections.submit?.allowedArtifactTypes && details.sections.submit.allowedArtifactTypes.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 900 }}>Allowed artifacts</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {details.sections.submit.allowedArtifactTypes.map((type) => (
                  <span key={type} style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontSize: "13px", fontWeight: 700 }}>{type}</span>
                ))}
              </div>
            </div>
          )}

          {details?.sections.submit?.submissionItems && details.sections.submit.submissionItems.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 10px", fontSize: "20px", fontWeight: 900 }}>Submission items</h3>
              <div style={{ display: "grid", gap: "12px" }}>
                {details.sections.submit.submissionItems.map((item) => (
                  <div key={item.key} style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "16px 18px" }}>
                    <div style={{ fontWeight: 800, marginBottom: "6px" }}>{item.title}</div>
                    <div style={{ color: "#6b7280", fontSize: "14px" }}>{item.format}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {submissionItems.length > 0 ? (
            <>
              {!currentUserId ? (
                <div
                  style={{
                    marginTop: "18px",
                    borderRadius: "18px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "18px",
                    color: "#4b5563",
                  }}
                >
                  Login is required to save submissions. {" "}
                  <Link href={authRedirectUrl} style={{ color: "#2563eb", fontWeight: 800 }}>
                    Open auth
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "18px",
                    borderRadius: "18px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "18px",
                    color: "#374151",
                  }}
                >
                  Saving as {currentNickname || "current user"}.
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ marginTop: "18px" }}>
                <div style={{ display: "grid", gap: "14px" }}>
                  {submissionItems.map((item) => (
                    <div key={item.key}>
                      <label
                        htmlFor={`submission-${item.key}`}
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontSize: "14px",
                          fontWeight: 800,
                          color: "#111827",
                        }}
                      >
                        {item.title}
                      </label>

                      {isUrlFormat(item.format) ? (
                        <input
                          id={`submission-${item.key}`}
                          type="url"
                          value={submissionValues[item.key] ?? ""}
                          onChange={(e) => handleSubmissionValueChange(item.key, e.target.value)}
                          placeholder={getInputPlaceholder(item.format)}
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
                      ) : (
                        <textarea
                          id={`submission-${item.key}`}
                          value={submissionValues[item.key] ?? ""}
                          onChange={(e) => handleSubmissionValueChange(item.key, e.target.value)}
                          placeholder={getInputPlaceholder(item.format)}
                          rows={item.format === "text_or_url" ? 3 : 4}
                          style={{
                            width: "100%",
                            padding: "12px 14px",
                            borderRadius: "14px",
                            border: "1px solid #d1d5db",
                            outline: "none",
                            fontSize: "15px",
                            background: "#fbfcfe",
                            resize: "vertical",
                          }}
                        />
                      )}
                    </div>
                  ))}

                  <div>
                    <label
                      htmlFor="submission-notes"
                      style={{
                        display: "block",
                        marginBottom: "8px",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#111827",
                      }}
                    >
                      Notes
                    </label>
                    <textarea
                      id="submission-notes"
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      placeholder="Optional notes"
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: "14px",
                        border: "1px solid #d1d5db",
                        outline: "none",
                        fontSize: "15px",
                        background: "#fbfcfe",
                        resize: "vertical",
                      }}
                    />
                  </div>
                </div>

                {submitError && (
                  <div
                    style={{
                      marginTop: "14px",
                      borderRadius: "14px",
                      padding: "12px 14px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    {submitError}
                  </div>
                )}

                {submitSuccess && (
                  <div
                    style={{
                      marginTop: "14px",
                      borderRadius: "14px",
                      padding: "12px 14px",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      color: "#047857",
                      fontWeight: 700,
                    }}
                  >
                    {submitSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!currentUserId}
                  style={{
                    marginTop: "16px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "12px 16px",
                    borderRadius: "14px",
                    background: currentUserId ? "#2563eb" : "#9ca3af",
                    color: "#ffffff",
                    fontWeight: 800,
                    border: "none",
                    cursor: currentUserId ? "pointer" : "not-allowed",
                  }}
                >
                  Save submission
                </button>
              </form>

              <div style={{ marginTop: "22px" }}>
                <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>
                  Submission history
                </h3>

                {!currentUserId ? (
                  <div
                    style={{
                      borderRadius: "18px",
                      background: "#f8fafc",
                      border: "1px solid #e5e7eb",
                      padding: "18px",
                      color: "#6b7280",
                    }}
                  >
                    Login to view your saved submissions.
                  </div>
                ) : submissionHistory.length > 0 ? (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {submissionHistory.map((record) => (
                      <div
                        key={record.id}
                        style={{
                          borderRadius: "18px",
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          padding: "16px 18px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: "12px",
                            flexWrap: "wrap",
                            marginBottom: "10px",
                          }}
                        >
                          <div style={{ fontWeight: 800, color: "#111827" }}>Saved submission</div>
                          <div style={{ color: "#6b7280", fontSize: "14px" }}>
                            {formatDate(record.submittedAt)}
                          </div>
                        </div>

                        <div style={{ display: "grid", gap: "10px" }}>
                          {submissionItems.map((item) => {
                            const value = record.values[item.key];
                            if (!value) return null;

                            return (
                              <div key={`${record.id}-${item.key}`}>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    color: "#6b7280",
                                    marginBottom: "4px",
                                  }}
                                >
                                  {item.title}
                                </div>

                                {isUrlFormat(item.format) ? (
                                  <a
                                    href={value}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: "#2563eb", fontWeight: 700 }}
                                  >
                                    {value}
                                  </a>
                                ) : (
                                  <div style={{ color: "#111827", lineHeight: 1.7 }}>{value}</div>
                                )}
                              </div>
                            );
                          })}

                          {record.notes && (
                            <div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  color: "#6b7280",
                                  marginBottom: "4px",
                                }}
                              >
                                Notes
                              </div>
                              <div style={{ color: "#111827", lineHeight: 1.7 }}>
                                {record.notes}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: "18px",
                      background: "#f8fafc",
                      border: "1px solid #e5e7eb",
                      padding: "18px",
                      color: "#6b7280",
                    }}
                  >
                    No submissions saved yet.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div
              style={{
                marginTop: "18px",
                borderRadius: "18px",
                background: "#f8fafc",
                border: "1px solid #e5e7eb",
                padding: "18px",
                color: "#6b7280",
              }}
            >
              No submission items are configured for this hackathon.
            </div>
          )}
        </SectionCard>
      )}
      {teamActionModalOpen && (
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
              maxWidth: "520px",
              borderRadius: "24px",
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
              padding: "24px",
            }}
          >
            <h3 style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: 900, color: "#111827" }}>
              Team setup checklist
            </h3>
            <p style={{ margin: "0 0 14px", color: "#374151", lineHeight: 1.8 }}>
              Review the checklist before starting a team invite or join action.
            </p>
            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px" }}>
              <div style={{ fontWeight: 800, color: "#111827", marginBottom: "10px" }}>Team setup notes</div>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#374151", lineHeight: 1.9 }}>
                <li>Check the maximum team size before inviting members.</li>
                <li>Confirm who is responsible for the final submission.</li>
                <li>Review team status before the deadline.</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", marginTop: "18px" }}>
              <button
                type="button"
                onClick={handleTeamActionCancel}
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
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTeamActionConfirm}
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
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <SectionCard title="Leaderboard">
          <p style={{ margin: "0 0 16px", color: "#374151", lineHeight: 1.8 }}>
            {details?.sections.leaderboard?.note ?? "Leaderboard details are not available yet."}
          </p>

          {leaderboardPreview.length > 0 ? (
            <>
              <div style={{ display: "grid", gap: "12px", marginBottom: "18px" }}>
                {leaderboardPreview.map((entry) => (
                  <div key={`${entry.rank}-${entry.teamName}`} style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <div>
                        <div style={{ color: "#2563eb", fontWeight: 800, marginBottom: "4px" }}>Rank {entry.rank}</div>
                        <div style={{ fontSize: "20px", fontWeight: 900 }}>{entry.teamName}</div>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>{safeScore(entry.score)}</div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}>Submitted {formatDate(entry.submittedAt)}</div>
                    {entry.scoreBreakdown && (
                      <div style={{ color: "#374151", fontSize: "14px", lineHeight: 1.7 }}>
                        Participant {entry.scoreBreakdown.participant ?? "-"} - Judge {entry.scoreBreakdown.judge ?? "-"}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link href="/rankings" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 16px", borderRadius: "14px", background: "#2563eb", color: "#ffffff", fontWeight: 800 }}>
                  View all rankings
                </Link>
                <div style={{ color: "#6b7280", fontSize: "14px", alignSelf: "center" }}>Last updated {leaderboard ? formatDate(leaderboard.updatedAt) : "-"}</div>
              </div>
            </>
          ) : (
            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px", color: "#6b7280" }}>
              Public leaderboard data is not available yet for this hackathon.
            </div>
          )}
        </SectionCard>
      )}
    </main>
  );
}

