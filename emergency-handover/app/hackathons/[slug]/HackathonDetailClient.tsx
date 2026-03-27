"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import StatePanel from "../../../components/ui/StatePanel";
import leaderboardData from "../../../data/public_leaderboard.json";
import initialTeams from "../../../data/public_teams.json";
import {
  MAX_SUBMISSION_FILE_SIZE,
  buildSubmissionConfigs,
  formatFileSize,
  getSubmissionStatusLabel,
  isDeadlineClosed,
  matchesAllowedFileType,
  type SubmissionFileType,
  type SubmissionInputMode,
  type SubmissionItemConfig,
  type SubmissionItemSource,
} from "../../../lib/hackathon-submissions";
import { AUTH_CHANGED_EVENT, getCurrentSession, getTeamOwners } from "../../../lib/local-auth";
import { getHackathonDisplayStatus } from "../../../lib/hackathon-status";
import {
  deleteSubmissionFile,
  getSubmissionFileBlob,
  saveSubmissionFile,
  type StoredSubmissionFileMeta,
} from "../../../lib/submission-files";
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

type SubmissionRecord = {
  id: string;
  userId: string;
  hackathonSlug: string;
  itemKey: string;
  submittedAt: string;
  updatedAt: string;
  memo: string;
  textValue: string;
  urlValue: string;
  fileId?: string;
  originalFilename?: string;
  mimeType?: string;
  size?: number;
};

type SubmissionDraft = {
  memo: string;
  textValue: string;
  urlValue: string;
  selectedFile: File | null;
  selectedFileName: string;
  selectedFileSize: number;
  selectedFileType: string;
  clearExistingFile: boolean;
};

type TeamJoinStatus = "pending" | "accepted" | "rejected";

type TeamJoinRequest = {
  teamCode: string;
  requesterId: string;
  requesterName: string;
  role: string;
  message?: string;
  portfolioUrl?: string;
  status: TeamJoinStatus;
  createdAt: string;
  respondedAt?: string;
};

type PendingTeamAction =
  | { type: "navigate"; url: string }
  | { type: "request"; teamCode: string; role: string; message?: string; portfolioUrl?: string }
  | { type: "review"; teamCode: string; requesterId: string; nextStatus: Exclude<TeamJoinStatus, "pending"> };

const SUBMISSION_STORAGE_PREFIX = "hackathon-submissions-v1";
const TEAM_JOIN_REQUESTS_PREFIX = "team-join-requests-v1";
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

function findTeamByCode(teams: Team[], teamCode: string) {
  return teams.find((team) => team.teamCode === teamCode) ?? null;
}

function getHackathonMembership(
  teams: Team[],
  teamOwners: Record<string, string>,
  requests: TeamJoinRequest[],
  userId: string,
  hackathonSlug: string
) {
  const normalizedUserId = userId.trim();
  const normalizedSlug = hackathonSlug.trim();
  if (!normalizedUserId || !normalizedSlug) return null;

  const ownedTeam = teams.find(
    (team) => team.hackathonSlug === normalizedSlug && teamOwners[team.teamCode] === normalizedUserId
  );
  if (ownedTeam) {
    return { kind: "owner" as const, teamCode: ownedTeam.teamCode };
  }

  const acceptedRequest = requests.find((request) => {
    if (request.requesterId !== normalizedUserId || request.status !== "accepted") return false;
    const targetTeam = findTeamByCode(teams, request.teamCode);
    return !!targetTeam && targetTeam.hackathonSlug === normalizedSlug;
  });

  if (acceptedRequest) {
    return { kind: "member" as const, teamCode: acceptedRequest.teamCode };
  }

  return null;
}

function isUrlFormat(format: string) {
  return format === "url" || format === "pdf_url";
}

function isValidUrl(value: string) {
  return value.startsWith("http://") || value.startsWith("https://");
}

function getInputPlaceholder(format: string) {
  if (isUrlFormat(format)) return "https://example.com";
  if (format === "text_or_url") return "텍스트를 입력하거나 URL을 붙여 넣어 주세요";
  return "내용을 입력해 주세요";
}

function makeEmptySubmissionDraft(): SubmissionDraft {
  return {
    memo: "",
    textValue: "",
    urlValue: "",
    selectedFile: null,
    selectedFileName: "",
    selectedFileSize: 0,
    selectedFileType: "",
    clearExistingFile: false,
  };
}

function makeInitialSubmissionDrafts(items: SubmissionItemConfig[]) {
  return items.reduce<Record<string, SubmissionDraft>>((acc, item) => {
    acc[item.key] = makeEmptySubmissionDraft();
    return acc;
  }, {});
}

function getRecordForItem(records: SubmissionRecord[], itemKey: string) {
  return records.find((record) => record.itemKey === itemKey) ?? null;
}

function normalizeLegacySubmissionHistory(
  records: unknown,
  configs: SubmissionItemConfig[],
  userId: string,
  hackathonSlug: string
) {
  if (!Array.isArray(records)) return [] as SubmissionRecord[];

  const normalized: SubmissionRecord[] = [];

  for (const record of records) {
    if (!record || typeof record !== "object") continue;

    const candidate = record as Record<string, unknown>;
    if (typeof candidate.itemKey === "string") {
      normalized.push({
        id: typeof candidate.id === "string" ? candidate.id : `${hackathonSlug}-${candidate.itemKey}-${userId}`,
        userId: typeof candidate.userId === "string" ? candidate.userId : userId,
        hackathonSlug: typeof candidate.hackathonSlug === "string" ? candidate.hackathonSlug : hackathonSlug,
        itemKey: candidate.itemKey,
        submittedAt: typeof candidate.submittedAt === "string" ? candidate.submittedAt : new Date().toISOString(),
        updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : typeof candidate.submittedAt === "string" ? candidate.submittedAt : new Date().toISOString(),
        memo: typeof candidate.memo === "string" ? candidate.memo : "",
        textValue: typeof candidate.textValue === "string" ? candidate.textValue : "",
        urlValue: typeof candidate.urlValue === "string" ? candidate.urlValue : "",
        fileId: typeof candidate.fileId === "string" ? candidate.fileId : undefined,
        originalFilename: typeof candidate.originalFilename === "string" ? candidate.originalFilename : undefined,
        mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : undefined,
        size: typeof candidate.size === "number" ? candidate.size : undefined,
      });
      continue;
    }

    const values = candidate.values;
    if (!values || typeof values !== "object") continue;
    const submittedAt = typeof candidate.submittedAt === "string" ? candidate.submittedAt : new Date().toISOString();
    const notes = typeof candidate.notes === "string" ? candidate.notes : "";

    for (const config of configs) {
      const rawValue = (values as Record<string, unknown>)[config.key];
      if (typeof rawValue !== "string" || !rawValue.trim()) continue;
      normalized.push({
        id: `${hackathonSlug}-${config.key}-${submittedAt}`,
        userId,
        hackathonSlug,
        itemKey: config.key,
        submittedAt,
        updatedAt: submittedAt,
        memo: notes,
        textValue: config.inputModes.includes("url") && !config.inputModes.includes("memo") ? "" : rawValue,
        urlValue: config.inputModes.includes("url") ? rawValue : "",
      });
    }
  }

  return normalized;
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode; }) {
  return (
    <button
      onClick={onClick}
      className={`tab-button ${active ? "tab-button--active" : ""}`}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode; }) {
  return (
    <section className="section-card">
      <h2 className="section-title" style={{ marginBottom: "14px" }}>{title}</h2>
      {children}
    </section>
  );
}

function StatCard({ label, value, tone = "default" }: { label: string; value: React.ReactNode; tone?: "default" | "blue"; }) {
  const palette = tone === "blue"
    ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
    : { background: "#f8fafc", border: "#e5e7eb", color: "#111827" };

  return (
    <div className="metric-card" style={{ background: palette.background, borderColor: palette.border }}>
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: palette.color }}>{value}</div>
    </div>
  );
}

export default function HackathonDetailClient({ hackathon, details }: { hackathon: Hackathon; details?: DetailHackathon; }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [now, setNow] = useState(() => Date.now());
  const [teams, setTeams] = useState<Team[]>(initialTeams as Team[]);
  const [storageReady, setStorageReady] = useState(false);
  const [teamsError, setTeamsError] = useState("");
  const [joinRequestsError, setJoinRequestsError] = useState("");
  const [submissionLoadError, setSubmissionLoadError] = useState("");
  const displayStatus = useMemo(() => getHackathonDisplayStatus(hackathon, now), [hackathon, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
      setTeamsError("팀 정보를 불러오는 중 문제가 발생했습니다.");
    }

    syncAuthState();
    setTeamOwners(getTeamOwners());
    window.addEventListener(AUTH_CHANGED_EVENT, syncAuthState);
    window.addEventListener("storage", syncAuthState);
    setStorageReady(true);

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
  const unsubmittedTeams = useMemo(() => {
    const rankedTeamNames = new Set(
      (leaderboard?.entries ?? []).map((entry) => entry.teamName.trim().toLowerCase())
    );
    const seenTeamNames = new Set<string>();

    return hackathonTeams.filter((team) => {
      const normalizedName = team.name.trim().toLowerCase();
      if (!normalizedName) return false;
      if (seenTeamNames.has(normalizedName)) return false;
      seenTeamNames.add(normalizedName);
      return !rankedTeamNames.has(normalizedName);
    });
  }, [hackathonTeams, leaderboard]);
  const maxTeamSize = details?.sections.overview?.teamPolicy?.maxTeamSize ?? "-";
  const allowSolo = details?.sections.overview?.teamPolicy?.allowSolo;
  const quickLinks = details?.sections.info?.links;
  const notices = details?.sections.info?.notice ?? [];
  const scheduleMilestones = useMemo(
    () =>
      [...(details?.sections.schedule?.milestones ?? [])].sort(
        (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
      ),
    [details]
  );
  const nextMilestone = useMemo(
    () => scheduleMilestones.find((milestone) => new Date(milestone.at).getTime() >= Date.now()) ?? null,
    [scheduleMilestones]
  );
  const submissionItems = useMemo(
    () =>
      buildSubmissionConfigs({
        submissionItems: (details?.sections.submit?.submissionItems ?? []) as SubmissionItemSource[],
        allowedArtifactTypes: details?.sections.submit?.allowedArtifactTypes,
        submissionDeadlineAt: hackathon.period.submissionDeadlineAt,
        scheduleMilestones,
      }),
    [details, hackathon.period.submissionDeadlineAt, scheduleMilestones]
  );
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [submissionHistory, setSubmissionHistory] = useState<SubmissionRecord[]>([]);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string>>({});
  const [submitSuccess, setSubmitSuccess] = useState<Record<string, string>>({});
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentNickname, setCurrentNickname] = useState("");
  const [requestModalTeamCode, setRequestModalTeamCode] = useState("");
  const [requestRole, setRequestRole] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestPortfolioUrl, setRequestPortfolioUrl] = useState("");
  const [requestFormError, setRequestFormError] = useState("");
  const [teamActionModalOpen, setTeamActionModalOpen] = useState(false);
  const [pendingTeamAction, setPendingTeamAction] = useState<PendingTeamAction | null>(null);
  const [teamOwners, setTeamOwners] = useState<Record<string, string>>({});
  const [teamJoinRequests, setTeamJoinRequests] = useState<TeamJoinRequest[]>([]);
  const ownerTeams = useMemo(
    () =>
      hackathonTeams.filter(
        (team) => !!currentUserId && teamOwners[team.teamCode] === currentUserId
      ),
    [currentUserId, hackathonTeams, teamOwners]
  );
  const currentMembership = useMemo(
    () => getHackathonMembership(hackathonTeams, teamOwners, teamJoinRequests, currentUserId, hackathon.slug),
    [currentUserId, hackathon.slug, hackathonTeams, teamJoinRequests, teamOwners]
  );

  useEffect(() => {
    try {
      setJoinRequestsError("");
      const stored = window.localStorage.getItem(getTeamJoinRequestsStorageKey(hackathon.slug));
      if (!stored) {
        setTeamJoinRequests([]);
        return;
      }

      const parsed = JSON.parse(stored) as TeamJoinRequest[];
      setTeamJoinRequests(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTeamJoinRequests([]);
      setJoinRequestsError("참여 요청 정보를 불러오는 중 문제가 발생했습니다.");
    }
  }, [hackathon.slug]);

  useEffect(() => {
    const initialDrafts = makeInitialSubmissionDrafts(submissionItems);
    setSubmissionDrafts(initialDrafts);
    setSubmissionLoadError("");
    setSubmitErrors({});
    setSubmitSuccess({});

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

      const parsed = JSON.parse(stored) as unknown;
      const normalized = normalizeLegacySubmissionHistory(parsed, submissionItems, currentUserId, hackathon.slug);
      setSubmissionHistory(normalized);

      const hydratedDrafts = makeInitialSubmissionDrafts(submissionItems);
      for (const item of submissionItems) {
        const record = getRecordForItem(normalized, item.key);
        if (!record) continue;
        hydratedDrafts[item.key] = {
          ...hydratedDrafts[item.key],
          memo: record.memo,
          textValue: record.textValue,
          urlValue: record.urlValue,
        };
      }
      setSubmissionDrafts(hydratedDrafts);
    } catch {
      setSubmissionHistory([]);
      setSubmissionLoadError("제출 이력을 불러오는 중 문제가 발생했습니다.");
    }
  }, [currentUserId, hackathon.slug, submissionItems]);

  useEffect(() => {
    function syncJoinRequestsFromEvents() {
      try {
        const stored = window.localStorage.getItem(getTeamJoinRequestsStorageKey(hackathon.slug));
        if (!stored) {
          setJoinRequestsError("");
          setTeamJoinRequests([]);
          return;
        }

        const parsed = JSON.parse(stored) as TeamJoinRequest[];
        setJoinRequestsError("");
        setTeamJoinRequests(Array.isArray(parsed) ? parsed : []);
      } catch {
        setTeamJoinRequests([]);
        setJoinRequestsError("참여 요청 정보를 불러오는 중 문제가 발생했습니다.");
      }
    }

    window.addEventListener(MESSAGE_HUB_CHANGED_EVENT, syncJoinRequestsFromEvents);
    window.addEventListener("storage", syncJoinRequestsFromEvents);
    window.addEventListener("focus", syncJoinRequestsFromEvents);

    return () => {
      window.removeEventListener(MESSAGE_HUB_CHANGED_EVENT, syncJoinRequestsFromEvents);
      window.removeEventListener("storage", syncJoinRequestsFromEvents);
      window.removeEventListener("focus", syncJoinRequestsFromEvents);
    };
  }, [hackathon.slug]);

  function updateSubmissionDraft(itemKey: string, patch: Partial<SubmissionDraft>) {
    setSubmissionDrafts((current) => ({
      ...current,
      [itemKey]: {
        ...(current[itemKey] ?? makeEmptySubmissionDraft()),
        ...patch,
      },
    }));
  }

  function persistTeamJoinRequests(nextRequests: TeamJoinRequest[]) {
    setTeamJoinRequests(nextRequests);
    window.localStorage.setItem(
      getTeamJoinRequestsStorageKey(hackathon.slug),
      JSON.stringify(nextRequests)
    );
  }

  function resetRequestForm() {
    setRequestModalTeamCode("");
    setRequestRole("");
    setRequestMessage("");
    setRequestPortfolioUrl("");
    setRequestFormError("");
  }

  function handleRequestModalOpen(teamCode: string) {
    const membership = getHackathonMembership(hackathonTeams, teamOwners, teamJoinRequests, currentUserId, hackathon.slug);
    if (membership && membership.teamCode !== teamCode) {
      setRequestFormError(
        membership.kind === "owner"
          ? "이미 이 해커톤에서 팀을 운영 중이라 다른 팀에 참여할 수 없습니다."
          : "이미 이 해커톤의 다른 팀에 소속되어 있어 추가 참여가 불가능합니다."
      );
      return;
    }

    resetRequestForm();
    setRequestModalTeamCode(teamCode);
  }

  function handleRequestModalClose() {
    resetRequestForm();
  }

  function handleRequestDraftSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!requestModalTeamCode) return;

    if (!requestRole.trim()) {
      setRequestFormError("지원 포지션을 입력해 주세요.");
      return;
    }

    if (requestPortfolioUrl.trim() && !isValidUrl(requestPortfolioUrl.trim())) {
      setRequestFormError("포트폴리오 또는 GitHub 링크는 올바른 URL로 입력해 주세요.");
      return;
    }

    setRequestFormError("");
    handleTeamActionStart({
      type: "request",
      teamCode: requestModalTeamCode,
      role: requestRole.trim(),
      message: requestMessage.trim(),
      portfolioUrl: requestPortfolioUrl.trim(),
    });
    resetRequestForm();
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
        const membership = getHackathonMembership(hackathonTeams, teamOwners, teamJoinRequests, currentUserId, hackathon.slug);
        const existing = teamJoinRequests.find(
          (request) => request.teamCode === pendingTeamAction.teamCode && request.requesterId === currentUserId
        );

        if (!existing && (!membership || membership.teamCode === pendingTeamAction.teamCode)) {
          persistTeamJoinRequests([
            {
              teamCode: pendingTeamAction.teamCode,
              requesterId: currentUserId,
              requesterName: currentNickname || "Member",
              role: pendingTeamAction.role,
              message: pendingTeamAction.message || "",
              portfolioUrl: pendingTeamAction.portfolioUrl || "",
              status: "pending",
              createdAt: new Date().toISOString(),
            },
            ...teamJoinRequests,
          ]);
        } else if (membership && membership.teamCode !== pendingTeamAction.teamCode) {
          alert(
            membership.kind === "owner"
              ? "이미 이 해커톤에서 팀을 운영 중이라 다른 팀에 참여할 수 없습니다."
              : "이미 이 해커톤의 다른 팀에 소속되어 있어 추가 참여가 불가능합니다."
          );
        }
      }
    }

    if (pendingTeamAction.type === "review") {
      const targetRequest = teamJoinRequests.find(
        (request) =>
          request.teamCode === pendingTeamAction.teamCode &&
          request.requesterId === pendingTeamAction.requesterId &&
          request.status === "pending"
      );

      if (targetRequest) {
        const respondedAt = new Date().toISOString();
        const requesterMembership = getHackathonMembership(
          hackathonTeams,
          teamOwners,
          teamJoinRequests,
          pendingTeamAction.requesterId,
          hackathon.slug
        );

        if (
          pendingTeamAction.nextStatus === "accepted" &&
          requesterMembership &&
          requesterMembership.teamCode !== pendingTeamAction.teamCode
        ) {
          alert(
            requesterMembership.kind === "owner"
              ? "이 요청자는 이미 이 해커톤에서 다른 팀을 운영 중입니다."
              : "이 요청자는 이미 이 해커톤의 다른 팀에 소속되어 있습니다."
          );
        } else {
          const reviewedStatus: TeamJoinStatus = pendingTeamAction.nextStatus;
          const nextRequests = teamJoinRequests.map<TeamJoinRequest>((request) => {
            const requestTeam = findTeamByCode(hackathonTeams, request.teamCode);
            const sameHackathon = !!requestTeam && requestTeam.hackathonSlug === hackathon.slug;
            const sameRequester = request.requesterId === pendingTeamAction.requesterId;
            const isTarget =
              request.teamCode === pendingTeamAction.teamCode &&
              request.requesterId === pendingTeamAction.requesterId &&
              request.createdAt === targetRequest.createdAt;

            if (isTarget) {
              return {
                ...request,
                status: reviewedStatus,
                respondedAt,
              };
            }

            if (
              pendingTeamAction.nextStatus === "accepted" &&
              sameRequester &&
              sameHackathon &&
              request.status === "pending"
            ) {
              return { ...request, status: "rejected", respondedAt };
            }

            return request;
          });
          persistTeamJoinRequests(nextRequests);
        }
      }
    }

    setTeamActionModalOpen(false);
    setPendingTeamAction(null);
  }

  function clearSubmitMessage(itemKey: string) {
    setSubmitErrors((current) => ({ ...current, [itemKey]: "" }));
    setSubmitSuccess((current) => ({ ...current, [itemKey]: "" }));
  }

  async function handleSelectedFile(item: SubmissionItemConfig, file: File | null) {
    if (!file) {
      updateSubmissionDraft(item.key, {
        selectedFile: null,
        selectedFileName: "",
        selectedFileSize: 0,
        selectedFileType: "",
      });
      return;
    }

    if (!matchesAllowedFileType(file, item.allowedFileTypes as SubmissionFileType[])) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "허용되지 않은 파일 형식입니다." }));
      return;
    }

    if (file.size > MAX_SUBMISSION_FILE_SIZE) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "파일 크기가 제한을 초과했습니다." }));
      return;
    }

    clearSubmitMessage(item.key);
    updateSubmissionDraft(item.key, {
      selectedFile: file,
      selectedFileName: file.name,
      selectedFileSize: file.size,
      selectedFileType: file.type,
      clearExistingFile: false,
    });
  }

  async function handleDownloadStoredFile(record: SubmissionRecord) {
    if (!record.fileId || !record.originalFilename) return;

    const blob = await getSubmissionFileBlob(record.fileId);
    if (!blob) {
      setSubmitErrors((current) => ({ ...current, [record.itemKey]: "파일을 불러오지 못했습니다." }));
      return;
    }

    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = record.originalFilename;
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
  }

  async function handleSubmitItem(item: SubmissionItemConfig) {
    if (!currentUserId) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "제출을 저장하려면 Login이 필요합니다." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    if (isDeadlineClosed(item.deadlineAt)) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "제출 마감이 지나 수정할 수 없습니다." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    const draft = submissionDrafts[item.key] ?? makeEmptySubmissionDraft();
    const existing = getRecordForItem(submissionHistory, item.key);
    const memo = draft.memo.trim();
    const textValue = draft.textValue.trim();
    const urlValue = draft.urlValue.trim();

    if (item.inputModes.includes("url") && urlValue && !isValidUrl(urlValue)) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "올바른 웹 링크를 입력해주세요." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    const hasExistingFile = !!existing?.fileId && !draft.clearExistingFile;
    const hasSelectedFile = !!draft.selectedFile;

    const hasAnyValue =
      memo.length > 0 ||
      textValue.length > 0 ||
      urlValue.length > 0 ||
      hasExistingFile ||
      hasSelectedFile;

    if (item.required && !hasAnyValue) {
      setSubmitErrors((current) => ({ ...current, [item.key]: `${item.title} 항목을 입력해 주세요.` }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    if ((item.format === "url" || (item.key === "web" && item.inputModes.includes("url"))) && !urlValue) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "올바른 웹 링크를 입력해주세요." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    if (item.inputModes.includes("file") && item.required && !hasExistingFile && !hasSelectedFile) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "파일을 첨부해 주세요." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    if (item.inputModes.includes("file") && hasSelectedFile && draft.selectedFile && !matchesAllowedFileType(draft.selectedFile, item.allowedFileTypes as SubmissionFileType[])) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "허용되지 않은 파일 형식입니다." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    if (item.inputModes.includes("file") && hasSelectedFile && draft.selectedFile && draft.selectedFile.size > MAX_SUBMISSION_FILE_SIZE) {
      setSubmitErrors((current) => ({ ...current, [item.key]: "파일 크기가 제한을 초과했습니다." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
      return;
    }

    try {
      let nextFileMeta: StoredSubmissionFileMeta | null = existing?.fileId
        ? {
            fileId: existing.fileId,
            originalFilename: existing.originalFilename ?? "",
            mimeType: existing.mimeType ?? "",
            size: existing.size ?? 0,
          }
        : null;

      if (draft.clearExistingFile && existing?.fileId) {
        await deleteSubmissionFile(existing.fileId);
        nextFileMeta = null;
      }

      if (draft.selectedFile) {
        if (existing?.fileId) {
          await deleteSubmissionFile(existing.fileId);
        }
        nextFileMeta = await saveSubmissionFile(draft.selectedFile);
      }

      const now = new Date().toISOString();
      const nextRecord: SubmissionRecord = {
        id: existing?.id ?? `${hackathon.slug}-${item.key}-${currentUserId}`,
        userId: currentUserId,
        hackathonSlug: hackathon.slug,
        itemKey: item.key,
        submittedAt: existing?.submittedAt ?? now,
        updatedAt: now,
        memo,
        textValue,
        urlValue,
        fileId: nextFileMeta?.fileId,
        originalFilename: nextFileMeta?.originalFilename,
        mimeType: nextFileMeta?.mimeType,
        size: nextFileMeta?.size,
      };

      const nextHistory = [
        nextRecord,
        ...submissionHistory.filter((record) => record.itemKey !== item.key),
      ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      window.localStorage.setItem(
        getSubmissionStorageKey(hackathon.slug, currentUserId),
        JSON.stringify(nextHistory)
      );

      setSubmissionHistory(nextHistory);
      updateSubmissionDraft(item.key, {
        memo: nextRecord.memo,
        textValue: nextRecord.textValue,
        urlValue: nextRecord.urlValue,
        selectedFile: null,
        selectedFileName: "",
        selectedFileSize: 0,
        selectedFileType: "",
        clearExistingFile: false,
      });
      setSubmitErrors((current) => ({ ...current, [item.key]: "" }));
      setSubmitSuccess((current) => ({
        ...current,
        [item.key]: existing ? "수정 내용이 저장되었습니다." : "정상적으로 제출되었습니다.",
      }));
    } catch {
      setSubmitErrors((current) => ({ ...current, [item.key]: "제출을 저장하는 중 문제가 발생했습니다." }));
      setSubmitSuccess((current) => ({ ...current, [item.key]: "" }));
    }
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
    <main className="page-shell">
      <div style={{ marginBottom: "14px" }}>
        <Link href="/hackathons" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "#2563eb", fontWeight: 800, fontSize: "14px" }}>
          해커톤 목록으로 돌아가기
        </Link>
      </div>

      <section className="page-hero page-hero--dark" style={{ marginBottom: "18px", padding: "24px" }}>
        <div style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
            <span className={displayStatus.className} style={{ display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "0 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 800 }}>{displayStatus.label}</span>
            <span className="chip">{hackathon.period.timezone}</span>
          </div>

          <h1 style={{ margin: "0 0 10px", fontSize: "32px", lineHeight: 1.18, fontWeight: 800, letterSpacing: "-0.03em", maxWidth: "760px" }}>{hackathon.title}</h1>
          <p style={{ margin: "0", maxWidth: "760px", lineHeight: 1.7, fontSize: "15px", color: "rgba(255,255,255,0.9)" }}>{details?.sections.overview?.summary ?? "상세 안내가 아직 준비되지 않았습니다."}</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {hackathon.tags.map((tag) => (
              <span key={tag} className="tag-chip">#{tag}</span>
            ))}
          </div>
          <div className="hero-meta" style={{ marginTop: 0 }}>
            <span>제출 마감 {formatDate(hackathon.period.submissionDeadlineAt)}</span>
            <span>종료 {formatDate(hackathon.period.endAt)}</span>
            <span>최대 팀 인원 {maxTeamSize}명</span>
          </div>
          <div className="hero-actions" style={{ marginTop: "4px" }}>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("submit")}>
              제출 보기
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("teams")}>
              팀 보기
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveTab("leaderboard")}>
              리더보드 보기
            </button>
          </div>
        </div>
      </section>

      <section className="section-nav" style={{ marginBottom: "18px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>개요</TabButton>
          <TabButton active={activeTab === "evaluation"} onClick={() => setActiveTab("evaluation")}>평가</TabButton>
          <TabButton active={activeTab === "schedule"} onClick={() => setActiveTab("schedule")}>일정</TabButton>
          <TabButton active={activeTab === "prize"} onClick={() => setActiveTab("prize")}>상금</TabButton>
          <TabButton active={activeTab === "teams"} onClick={() => setActiveTab("teams")}>팀</TabButton>
          <TabButton active={activeTab === "submit"} onClick={() => setActiveTab("submit")}>제출</TabButton>
          <TabButton active={activeTab === "leaderboard"} onClick={() => setActiveTab("leaderboard")}>리더보드</TabButton>
        </div>
      </section>
      {activeTab === "overview" && (
        <SectionCard title="개요">
          <p style={{ margin: "0 0 14px", maxWidth: "760px", lineHeight: 1.72, color: "#374151", fontSize: "14px" }}>
            {details?.sections.overview?.summary ?? "상세 안내가 아직 준비되지 않았습니다."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "10px", marginBottom: notices.length > 0 || quickLinks ? "14px" : 0 }}>
            <div style={{ borderRadius: "14px", border: "1px solid #e5e7eb", background: "#fbfcfe", padding: "12px 14px" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>개인 참가</div>
              <div style={{ fontSize: "15px", color: "#111827", fontWeight: 800 }}>{allowSolo ? "가능" : "팀만 가능"}</div>
            </div>
            <div style={{ borderRadius: "14px", border: "1px solid #e5e7eb", background: "#fbfcfe", padding: "12px 14px" }}>
              <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 700, marginBottom: "4px" }}>최대 팀원 수</div>
              <div style={{ fontSize: "15px", color: "#111827", fontWeight: 800 }}>{maxTeamSize}</div>
            </div>
          </div>

          {notices.length > 0 && (
            <div style={{ display: "grid", gap: "8px", marginBottom: quickLinks ? "14px" : 0 }}>
              {notices.map((notice) => (
                <div
                  key={notice}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0, 1fr)",
                    gap: "10px",
                    alignItems: "start",
                    borderRadius: "12px",
                    border: "1px solid #f3e2a7",
                    background: "#fffaf0",
                    padding: "11px 12px",
                    color: "#92400e",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#d97706", marginTop: "8px" }} />
                  <span style={{ fontSize: "13px", lineHeight: 1.65, fontWeight: 600 }}>{notice}</span>
                </div>
              ))}
            </div>
          )}

          {quickLinks && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {quickLinks.rules && (
                <a href={quickLinks.rules} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: "38px", padding: "0 12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e5e7eb", fontWeight: 800, color: "#2563eb" }}>
                  안내 보기
                </a>
              )}
              {quickLinks.faq && (
                <a href={quickLinks.faq} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", minHeight: "38px", padding: "0 12px", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e5e7eb", fontWeight: 800, color: "#2563eb" }}>
                  FAQ 보기
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
        <SectionCard title="일정">
          {scheduleMilestones.length > 0 ? (
            <div className="stack-md">
              {nextMilestone ? (
                <div
                  style={{
                    borderRadius: "16px",
                    border: "1px solid #bfdbfe",
                    background: "#f8fbff",
                    padding: "16px 18px",
                  }}
                >
                  <div style={{ color: "#2563eb", fontSize: "12px", fontWeight: 800, marginBottom: "6px" }}>
                    다가오는 마감
                  </div>
                  <div style={{ color: "#0f172a", fontSize: "18px", fontWeight: 800, marginBottom: "4px" }}>
                    {nextMilestone.name}
                  </div>
                  <div className="muted">{formatDate(nextMilestone.at)}</div>
                </div>
              ) : null}

              <div className="timeline">
                {scheduleMilestones.map((milestone) => {
                  const isUpcoming = new Date(milestone.at).getTime() >= Date.now();

                  return (
                    <div
                      key={`${milestone.name}-${milestone.at}`}
                      className={`timeline-item ${isUpcoming ? "timeline-item--active" : ""}`}
                      style={{ padding: "15px 16px", gridTemplateColumns: "auto minmax(0, 1fr) auto" }}
                    >
                      <div className="timeline-dot" style={{ width: "12px", height: "12px", marginTop: "6px" }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>{milestone.name}</div>
                        <div className="muted" style={{ fontSize: "13px", lineHeight: 1.6 }}>
                          {isUpcoming ? "예정된 일정입니다." : "완료된 일정입니다."}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", display: "grid", gap: "8px", justifyItems: "end" }}>
                        <span className={isUpcoming ? "status-chip status-chip--pending" : "chip"}>
                          {isUpcoming ? "예정" : "완료"}
                        </span>
                        <div className="muted" style={{ fontSize: "13px", fontWeight: 700 }}>{formatDate(milestone.at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, color: "#6b7280" }}>일정 정보가 아직 준비되지 않았습니다.</p>
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
            이 해커톤의 팀 구성은 팀원 모집 게시판에서 관리됩니다. 이동하기 전에 현재 팀 상태를 먼저 확인해 주세요.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginBottom: "18px" }}>
            <StatCard label="팀원 모집 게시판" value={details?.sections.teams?.campEnabled ? "모집중" : "닫힘"} />
            <StatCard label="개인 참여" value={allowSolo ? "가능" : "불가"} />
            <StatCard label="최대 인원" value={maxTeamSize} />
            <StatCard label="모집중인 팀" value={openTeams.length} tone="blue" />
          </div>

          <div
            style={{
              borderRadius: "20px",
              background: "#fbfcfe",
              border: "1px solid #e5e7eb",
              padding: "18px",
              marginBottom: "18px",
            }}
          >
            <div style={{ marginBottom: "14px" }}>
              <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 900, color: "#111827" }}>
                공개 모집 정보
              </h3>
              <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", lineHeight: 1.7 }}>
                팀 소개와 모집 포지션처럼 공개 모집글 범위의 정보만 표시됩니다.
              </p>
            </div>

            {!storageReady ? (
              <StatePanel
                kind="loading"
                compact
                title="팀 정보를 불러오는 중입니다"
                description="잠시만 기다려 주세요."
              />
            ) : teamsError ? (
              <StatePanel
                kind="error"
                compact
                title={teamsError}
                description="다시 시도해 주세요."
              />
            ) : openTeams.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {openTeams.slice(0, 3).map((team) => {
                  const isOwner = isTeamOwner(team.teamCode);
                  const myJoinRequest = getMyJoinRequest(team.teamCode);
                  const blockedByOtherMembership =
                    !!currentMembership && currentMembership.teamCode !== team.teamCode;

                  return (
                    <article
                      key={team.teamCode}
                      style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                        <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 900 }}>{team.name}</h3>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          {isOwner ? (
                            <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 800, fontSize: "13px" }}>
                              내 팀
                            </span>
                          ) : null}
                          <span style={{ display: "inline-block", padding: "6px 10px", borderRadius: "999px", background: "#e8f7ea", color: "#1e7a35", fontWeight: 800, fontSize: "13px" }}>
                            모집중
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: "0 0 10px", color: "#374151", lineHeight: 1.7 }}>{team.intro}</p>

                      <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "12px" }}>
                        연결 해커톤 {hackathon.title}
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                        {team.lookingFor.length > 0 ? (
                          team.lookingFor.map((role) => (
                            <span
                              key={role}
                              style={{ display: "inline-block", padding: "7px 11px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontSize: "12px", fontWeight: 700 }}
                            >
                              {role}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: "#6b7280", fontSize: "14px" }}>모집 포지션 정보가 없습니다</span>
                        )}
                      </div>

                      {isOwner ? (
                        <div style={{ color: "#6b7280", fontSize: "14px" }}>
                          소유자 전용 요청 관리는 아래 영역에서 확인할 수 있습니다.
                        </div>
                      ) : myJoinRequest?.status === "accepted" ? (
                        <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#e8f7ea", color: "#1e7a35", fontWeight: 800, fontSize: "13px" }}>
                          참여중
                        </span>
                      ) : myJoinRequest?.status === "rejected" ? (
                        <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#f3f4f6", color: "#4b5563", fontWeight: 800, fontSize: "13px" }}>
                          거절됨
                        </span>
                      ) : blockedByOtherMembership ? (
                        <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#f3f4f6", color: "#4b5563", fontWeight: 800, fontSize: "13px" }}>
                          {currentMembership?.kind === "owner" ? "내 팀 운영 중" : "다른 팀 소속"}
                        </span>
                      ) : myJoinRequest?.status === "pending" ? (
                        <span style={{ display: "inline-block", padding: "8px 12px", borderRadius: "999px", background: "#eef4ff", color: "#2457c5", fontWeight: 800, fontSize: "13px" }}>
                          대기중
                        </span>
                      ) : currentUserId ? (
                        <button
                          type="button"
                          onClick={() => handleRequestModalOpen(team.teamCode)}
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
                          참여 요청
                        </button>
                      ) : (
                        <Link
                          href={authRedirectUrl}
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 14px", borderRadius: "10px", background: "#2563eb", color: "#ffffff", fontWeight: 800, textDecoration: "none" }}
                        >
                          Login 후 참여 요청
                        </Link>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <StatePanel
                kind="empty"
                compact
                title="아직 모집 중인 팀이 없습니다"
                description="팀 만들기 버튼으로 첫 팀 모집글을 등록해 보세요."
              />
            )}
          </div>

          {currentUserId && ownerTeams.length > 0 ? (
            <div
              style={{
                borderRadius: "20px",
                background: "#f8fafc",
                border: "1px solid #dbeafe",
                padding: "18px",
                marginBottom: "18px",
              }}
            >
              <div style={{ marginBottom: "14px" }}>
                <h3 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 900, color: "#111827" }}>
                  내 팀 요청 관리
                </h3>
                <p style={{ margin: 0, color: "#6b7280", fontSize: "14px", lineHeight: 1.7 }}>
                  소유자만 확인할 수 있는 정보입니다. 받은 참여 요청과 처리 상태를 여기에서 관리할 수 있습니다.
                </p>
              </div>

              <div style={{ display: "grid", gap: "14px" }}>
                {ownerTeams.map((team) => {
                  const ownerRequests = getTeamRequestsForOwner(team.teamCode);

                  return (
                    <div
                      key={`owner-${team.teamCode}`}
                      style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}
                    >
                      <div style={{ fontWeight: 900, color: "#111827", marginBottom: "12px" }}>{team.name}</div>

                      {ownerRequests.length > 0 ? (
                        <div style={{ display: "grid", gap: "10px" }}>
                          {ownerRequests.map((request) => (
                            <div
                              key={`${request.teamCode}-${request.requesterId}`}
                              style={{ borderRadius: "14px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "14px" }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: request.status === "pending" ? "10px" : 0 }}>
                                <div>
                                  <div style={{ fontWeight: 800, color: "#111827" }}>{request.requesterName}</div>
                                  <div style={{ color: "#374151", fontSize: "14px", marginTop: "4px" }}>
                                    지원 포지션 {request.role || "미입력"}
                                  </div>
                                  <div style={{ color: "#6b7280", fontSize: "13px" }}>요청 시각 {formatDate(request.createdAt)}</div>
                                </div>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "6px 10px",
                                    borderRadius: "999px",
                                    background: request.status === "accepted" ? "#e8f7ea" : request.status === "rejected" ? "#f3f4f6" : "#eef4ff",
                                    color: request.status === "accepted" ? "#1e7a35" : request.status === "rejected" ? "#4b5563" : "#2457c5",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                  }}
                                >
                                  {request.status === "pending" ? "대기중" : request.status === "accepted" ? "수락됨" : "거절됨"}
                                </span>
                              </div>

                              {request.message ? (
                                <div style={{ color: "#374151", fontSize: "14px", lineHeight: 1.7, marginBottom: request.status === "pending" ? "10px" : "0" }}>
                                  {request.message}
                                </div>
                              ) : null}

                              {request.portfolioUrl ? (
                                <div style={{ marginBottom: request.status === "pending" ? "10px" : "0" }}>
                                  <a href={request.portfolioUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", fontWeight: 700, fontSize: "14px" }}>
                                    포트폴리오 또는 GitHub 보기
                                  </a>
                                </div>
                              ) : null}

                              {request.status === "pending" ? (
                                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTeamActionStart({
                                        type: "review",
                                        teamCode: team.teamCode,
                                        requesterId: request.requesterId,
                                        nextStatus: "accepted",
                                      })
                                    }
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
                                    수락
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTeamActionStart({
                                        type: "review",
                                        teamCode: team.teamCode,
                                        requesterId: request.requesterId,
                                        nextStatus: "rejected",
                                      })
                                    }
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
                                    거절
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <StatePanel
                          kind={joinRequestsError ? "error" : "empty"}
                          compact
                          title={joinRequestsError || "아직 받은 요청이 없습니다"}
                          description={joinRequestsError ? "다시 시도해 주세요." : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {details?.sections.teams?.listUrl ? (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => handleTeamActionStart({ type: "navigate", url: `/camp?hackathon=${hackathon.slug}` })}
                disabled={!!currentMembership && currentMembership.kind === "member"}
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
                  cursor: !!currentMembership && currentMembership.kind === "member" ? "not-allowed" : "pointer",
                  opacity: !!currentMembership && currentMembership.kind === "member" ? 0.55 : 1,
                }}
              >
                팀 만들기
              </button>
              <button
                type="button"
                onClick={() => handleTeamActionStart({ type: "navigate", url: details.sections.teams!.listUrl! })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 16px",
                  borderRadius: "14px",
                  background: "#ffffff",
                  color: "#374151",
                  fontWeight: 800,
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                }}
              >
                팀원 모집 보기
              </button>
            </div>
          ) : (
            <StatePanel kind="empty" compact title="연결된 팀원 모집 게시판이 없습니다" />
          )}
        </SectionCard>
      )}

      {activeTab === "submit" && (
        <SectionCard title="제출">
          {details?.sections.submit?.guide && details.sections.submit.guide.length > 0 ? (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>제출 안내</h3>
              <div style={{ display: "grid", gap: "8px" }}>
                {details.sections.submit.guide.map((guide) => (
                  <div
                    key={guide}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr)",
                      gap: "10px",
                      alignItems: "start",
                      borderRadius: "12px",
                      border: "1px solid #e5e7eb",
                      background: "#fbfcfe",
                      padding: "10px 12px",
                      color: "#374151",
                    }}
                  >
                    <span style={{ width: "6px", height: "6px", borderRadius: "999px", background: "#2563eb", marginTop: "8px" }} />
                    <span style={{ fontSize: "13px", lineHeight: 1.65 }}>{guide}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <StatePanel
              kind="empty"
              compact
              title="제출 가이드가 없습니다"
              description="이 해커톤의 제출 안내가 준비되면 여기에 표시됩니다."
            />
          )}

          {details?.sections.submit?.allowedArtifactTypes && details.sections.submit.allowedArtifactTypes.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>허용 형식</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {details.sections.submit.allowedArtifactTypes.map((type) => (
                  <span key={type} style={{ display: "inline-flex", alignItems: "center", minHeight: "30px", padding: "0 10px", borderRadius: "999px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", fontSize: "12px", fontWeight: 700 }}>{type}</span>
                ))}
              </div>
            </div>
          )}

          {details?.sections.submit?.submissionItems && details.sections.submit.submissionItems.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h3 style={{ margin: "0 0 10px", fontSize: "16px", fontWeight: 800, color: "#111827" }}>제출 단계</h3>
              <div style={{ display: "grid", gap: "10px" }}>
                {details.sections.submit.submissionItems.map((item, index) => (
                  <div
                    key={item.key}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0, 1fr) auto",
                      gap: "12px",
                      alignItems: "start",
                      borderRadius: "12px",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ width: "24px", height: "24px", borderRadius: "999px", background: "#f3f4f6", color: "#111827", fontSize: "12px", fontWeight: 800, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      {index + 1}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>{item.title}</div>
                      <div style={{ color: "#6b7280", fontSize: "12px" }}>형식 {item.format}</div>
                    </div>
                    <div style={{ fontSize: "12px", color: "#9ca3af", fontWeight: 700, whiteSpace: "nowrap" }}>필수</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!storageReady ? (
            <StatePanel
              kind="loading"
              compact
              title="제출 정보를 불러오는 중입니다"
              description="잠시만 기다려 주세요."
            />
          ) : submissionItems.length > 0 ? (
            <>
              {!currentUserId ? (
                <div
                  style={{
                    marginTop: "18px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "14px 16px",
                    color: "#4b5563",
                    fontSize: "14px",
                  }}
                >
                  제출을 저장하려면 Login이 필요합니다. {" "}
                  <Link href={authRedirectUrl} style={{ color: "#2563eb", fontWeight: 800 }}>
                    Login 하러 가기
                  </Link>
                </div>
              ) : (
                <div
                  style={{
                    marginTop: "18px",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    padding: "14px 16px",
                    color: "#374151",
                    fontSize: "14px",
                  }}
                >
                  현재 사용자로 저장됩니다: {currentNickname || "member"}
                </div>
              )}

              {submissionLoadError ? (
                <div style={{ marginTop: "12px" }}>
                  <StatePanel kind="error" compact title={submissionLoadError} description="다시 시도해 주세요." />
                </div>
              ) : null}

              <div style={{ marginTop: "18px", display: "grid", gap: "12px" }}>
                {submissionItems.map((item) => {
                  const draft = submissionDrafts[item.key] ?? makeEmptySubmissionDraft();
                  const record = getRecordForItem(submissionHistory, item.key);
                  const deadlineClosed = isDeadlineClosed(item.deadlineAt);
                  const statusLabel = getSubmissionStatusLabel(!!record, deadlineClosed);
                  const statusStyle =
                    statusLabel === "마감됨"
                      ? { background: "#f3f4f6", color: "#4b5563" }
                      : statusLabel === "제출 완료"
                        ? { background: "#e8f7ea", color: "#1e7a35" }
                        : statusLabel === "수정 가능"
                          ? { background: "#eef4ff", color: "#2457c5" }
                          : { background: "#f3f4f6", color: "#6b7280" };
                  const existingFileVisible = !!record?.fileId && !draft.clearExistingFile;

                  return (
                    <section
                      key={item.key}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid #e5e7eb",
                        background: "#ffffff",
                        padding: "14px 16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start", marginBottom: "12px" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#111827", marginBottom: "4px" }}>{item.title}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>마감 {formatDate(item.deadlineAt)}</div>
                        </div>
                        <span style={{ display: "inline-flex", alignItems: "center", minHeight: "28px", padding: "0 10px", borderRadius: "999px", fontSize: "12px", fontWeight: 800, ...statusStyle }}>
                          {statusLabel}
                        </span>
                      </div>

                      <div style={{ display: "grid", gap: "12px" }}>
                        {item.inputModes.includes("memo") && (
                          <div>
                            <label htmlFor={`submission-memo-${item.key}`} style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 800, color: "#111827" }}>
                              메모
                            </label>
                            <textarea
                              id={`submission-memo-${item.key}`}
                              value={draft.memo}
                              onChange={(e) => {
                                clearSubmitMessage(item.key);
                                updateSubmissionDraft(item.key, { memo: e.target.value });
                              }}
                              placeholder="내용을 입력해 주세요"
                              rows={3}
                              disabled={deadlineClosed}
                              style={{ width: "100%", padding: "10px 12px", borderRadius: "12px", border: "1px solid #d1d5db", outline: "none", fontSize: "14px", background: deadlineClosed ? "#f8fafc" : "#ffffff", resize: "vertical" }}
                            />
                          </div>
                        )}

                        {item.inputModes.includes("text") && (
                          <div>
                            <label htmlFor={`submission-text-${item.key}`} style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 800, color: "#111827" }}>
                              입력 내용
                            </label>
                            <input
                              id={`submission-text-${item.key}`}
                              type="text"
                              value={draft.textValue}
                              onChange={(e) => {
                                clearSubmitMessage(item.key);
                                updateSubmissionDraft(item.key, { textValue: e.target.value });
                              }}
                              placeholder="내용을 입력해 주세요"
                              disabled={deadlineClosed}
                              style={{ width: "100%", height: "44px", padding: "0 12px", borderRadius: "12px", border: "1px solid #d1d5db", outline: "none", fontSize: "14px", background: deadlineClosed ? "#f8fafc" : "#ffffff" }}
                            />
                          </div>
                        )}

                        {item.inputModes.includes("url") && (
                          <div>
                            <label htmlFor={`submission-url-${item.key}`} style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 800, color: "#111827" }}>
                              웹 링크
                            </label>
                            <input
                              id={`submission-url-${item.key}`}
                              type="url"
                              value={draft.urlValue}
                              onChange={(e) => {
                                clearSubmitMessage(item.key);
                                updateSubmissionDraft(item.key, { urlValue: e.target.value });
                              }}
                              placeholder="https://example.com"
                              disabled={deadlineClosed}
                              style={{ width: "100%", height: "44px", padding: "0 12px", borderRadius: "12px", border: "1px solid #d1d5db", outline: "none", fontSize: "14px", background: deadlineClosed ? "#f8fafc" : "#ffffff" }}
                            />
                          </div>
                        )}

                        {item.inputModes.includes("file") && (
                          <div>
                            <label htmlFor={`submission-file-${item.key}`} style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 800, color: "#111827" }}>
                              파일 첨부
                            </label>
                            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "10px" }}>
                              허용 형식 {item.allowedFileTypes.join(", ")} / 최대 {formatFileSize(MAX_SUBMISSION_FILE_SIZE)}
                            </div>
                            <input
                              id={`submission-file-${item.key}`}
                              type="file"
                              accept={item.accept}
                              disabled={deadlineClosed}
                              onChange={(e) => {
                                void handleSelectedFile(item, e.target.files?.[0] ?? null);
                                e.currentTarget.value = "";
                              }}
                              style={{ width: "100%", fontSize: "13px" }}
                            />

                            {existingFileVisible && record ? (
                              <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "10px 12px" }}>
                                <div style={{ display: "grid", gap: "4px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827" }}>{record.originalFilename}</div>
                                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{formatFileSize(record.size ?? 0)}</div>
                                </div>
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <button type="button" className="btn btn-secondary" onClick={() => void handleDownloadStoredFile(record)}>
                                    파일 보기
                                  </button>
                                  {!deadlineClosed ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      onClick={() => {
                                        clearSubmitMessage(item.key);
                                        updateSubmissionDraft(item.key, { clearExistingFile: true });
                                      }}
                                    >
                                      파일 제거
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {draft.selectedFile ? (
                              <div style={{ marginTop: "10px", borderRadius: "12px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "10px 12px" }}>
                                <div style={{ fontSize: "13px", fontWeight: 700, color: "#111827", marginBottom: "4px" }}>{draft.selectedFileName}</div>
                                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "8px" }}>{formatFileSize(draft.selectedFileSize)}</div>
                                {!deadlineClosed ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => {
                                      clearSubmitMessage(item.key);
                                      updateSubmissionDraft(item.key, {
                                        selectedFile: null,
                                        selectedFileName: "",
                                        selectedFileSize: 0,
                                        selectedFileType: "",
                                      });
                                    }}
                                  >
                                    파일 제거
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )}

                        {submitErrors[item.key] ? (
                          <div style={{ borderRadius: "12px", padding: "11px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 700, fontSize: "14px" }}>
                            {submitErrors[item.key]}
                          </div>
                        ) : null}

                        {submitSuccess[item.key] ? (
                          <div style={{ borderRadius: "12px", padding: "11px 12px", background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#047857", fontWeight: 700, fontSize: "14px" }}>
                            {submitSuccess[item.key]}
                          </div>
                        ) : null}

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={!currentUserId || deadlineClosed}
                            onClick={() => void handleSubmitItem(item)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "11px 15px",
                              borderRadius: "12px",
                              background: !currentUserId || deadlineClosed ? "#9ca3af" : "#2563eb",
                              color: "#ffffff",
                              fontWeight: 800,
                              border: "none",
                              cursor: !currentUserId || deadlineClosed ? "not-allowed" : "pointer",
                            }}
                          >
                            {record ? "수정 저장" : "제출"}
                          </button>
                          {deadlineClosed ? <span style={{ fontSize: "12px", color: "#6b7280" }}>마감 후에는 읽기 전용으로 표시됩니다.</span> : null}
                        </div>

                        {record ? (
                          <div style={{ paddingTop: "4px", borderTop: "1px solid #f3f4f6", display: "grid", gap: "4px" }}>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>제출 시간 {formatDate(record.submittedAt)}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>마지막 수정 {formatDate(record.updatedAt)}</div>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  );
                })}
              </div>

                          </>
          ) : (
            <StatePanel
              kind="empty"
              compact
              title="제출 항목이 없습니다"
              description="이 해커톤의 제출 설정이 아직 준비되지 않았습니다."
            />
          )}
        </SectionCard>
      )}
      {requestModalTeamCode ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 58,
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
              팀 지원 정보
            </h3>
            <p style={{ margin: "0 0 16px", color: "#4b5563", lineHeight: 1.7 }}>
              지원 포지션과 간단한 소개를 남기면 팀 소유자가 더 쉽게 확인할 수 있습니다.
            </p>

            <form onSubmit={handleRequestDraftSubmit} style={{ display: "grid", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
                  지원 포지션
                </label>
                <input
                  value={requestRole}
                  onChange={(e) => setRequestRole(e.target.value)}
                  placeholder="예: Frontend, Designer"
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
                  한 줄 소개 또는 지원 메시지
                </label>
                <textarea
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  placeholder="선택 입력"
                  rows={3}
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

              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: 800, color: "#111827" }}>
                  포트폴리오 또는 GitHub 링크
                </label>
                <input
                  type="url"
                  value={requestPortfolioUrl}
                  onChange={(e) => setRequestPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/..."
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

              {requestFormError ? (
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
                  {requestFormError}
                </div>
              ) : null}

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleRequestModalClose}
                  style={{
                    padding: "11px 15px",
                    borderRadius: "12px",
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
                  다음
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
              팀 구성 전 유의사항
            </h3>
            <p style={{ margin: "0 0 14px", color: "#374151", lineHeight: 1.8 }}>
              팀 참여 또는 관리 액션을 진행하기 전에 아래 내용을 확인해 주세요.
            </p>
            <div style={{ borderRadius: "18px", background: "#f8fafc", border: "1px solid #e5e7eb", padding: "18px" }}>
              <div style={{ fontWeight: 800, color: "#111827", marginBottom: "10px" }}>확인할 내용</div>
              <ul style={{ margin: 0, paddingLeft: "20px", color: "#374151", lineHeight: 1.9 }}>
                <li>팀 최대 인원을 먼저 확인해 주세요.</li>
                <li>최종 제출 담당자를 미리 정해 주세요.</li>
                <li>마감 전 팀 상태를 다시 점검해 주세요.</li>
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
                취소
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
                확인 후 진행
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "leaderboard" && (
        <SectionCard title="리더보드">
          <p style={{ margin: "0 0 16px", color: "#374151", lineHeight: 1.8 }}>
            {details?.sections.leaderboard?.note ?? "리더보드 안내가 아직 준비되지 않았습니다."}
          </p>
          <p style={{ margin: "0 0 18px", color: "#6b7280", fontSize: "14px", lineHeight: 1.7 }}>
            리더보드에 없는 팀은 현재 미제출로 표시됩니다.
          </p>

          {!storageReady ? (
            <StatePanel
              kind="loading"
              compact
              title="리더보드 정보를 불러오는 중입니다"
              description="잠시만 기다려 주세요."
            />
          ) : leaderboardPreview.length > 0 ? (
            <>
              <div style={{ display: "grid", gap: "12px", marginBottom: "18px" }}>
                {leaderboardPreview.map((entry) => (
                  <div key={`${entry.rank}-${entry.teamName}`} style={{ borderRadius: "18px", background: "#ffffff", border: "1px solid #e5e7eb", padding: "18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap", marginBottom: "10px" }}>
                      <div>
                        <div style={{ color: "#2563eb", fontWeight: 800, marginBottom: "4px" }}>순위 {entry.rank}</div>
                        <div style={{ fontSize: "20px", fontWeight: 900 }}>{entry.teamName}</div>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#111827" }}>{safeScore(entry.score)}</div>
                    </div>
                    <div style={{ color: "#6b7280", fontSize: "14px", marginBottom: "8px" }}>제출일 {formatDate(entry.submittedAt)}</div>
                    {entry.scoreBreakdown && (
                      <div style={{ color: "#374151", fontSize: "14px", lineHeight: 1.7 }}>
                        참가자 {entry.scoreBreakdown.participant ?? "-"} - 심사위원 {entry.scoreBreakdown.judge ?? "-"}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link href="/rankings" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 16px", borderRadius: "14px", background: "#2563eb", color: "#ffffff", fontWeight: 800 }}>
                  전체 랭킹 보기
                </Link>
                <div style={{ color: "#6b7280", fontSize: "14px", alignSelf: "center" }}>마지막 업데이트 {leaderboard ? formatDate(leaderboard.updatedAt) : "-"}</div>
              </div>
            </>
          ) : (
            <StatePanel
              kind="empty"
              compact
              title="공개 리더보드 데이터가 없습니다"
              description="이 해커톤의 순위 데이터가 준비되면 여기에 표시됩니다."
            />
          )}

          <div style={{ marginTop: "22px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 900 }}>미제출 팀</h3>

            {hackathonTeams.length === 0 ? (
              <StatePanel
                kind="empty"
                compact
                title="현재 이 해커톤에 연결된 팀이 없습니다"
              />
            ) : unsubmittedTeams.length > 0 ? (
              <div style={{ display: "grid", gap: "12px" }}>
                {unsubmittedTeams.map((team) => (
                  <div
                    key={team.teamCode}
                    style={{
                      borderRadius: "18px",
                      background: "#ffffff",
                      border: "1px solid #e5e7eb",
                      padding: "16px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: "#111827", marginBottom: "4px" }}>
                        {team.name}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: "14px" }}>
                        등록일 {formatDate(team.createdAt)}
                      </div>
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        background: "#fef2f2",
                        color: "#b91c1c",
                        fontWeight: 800,
                        fontSize: "13px",
                      }}
                    >
                      미제출
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <StatePanel
                kind="empty"
                compact
                title="현재 미제출 팀이 없습니다"
              />
            )}
          </div>
        </SectionCard>
      )}
    </main>
  );
}

