export const DEFAULT_HACKATHON_TIMEZONE = "Asia/Seoul";

export type HackathonBaseStatusCode = "scheduled" | "ongoing" | "ended";
export type HackathonOverrideStatusCode =
  | "judging"
  | "extended"
  | "closed_early"
  | "private"
  | "paused";
export type HackathonDisplayStatusCode =
  | HackathonBaseStatusCode
  | HackathonOverrideStatusCode;
export type HackathonStatusMode = "auto" | "manual";
export type HackathonStatusTone = "upcoming" | "ongoing" | "ended" | "pending" | "closed";

type HackathonStatusLike = {
  status?: "ended" | "ongoing" | "upcoming";
  statusMode?: HackathonStatusMode;
  statusOverride?: HackathonOverrideStatusCode;
  period?: {
    timezone?: string;
    startAt?: string;
    submissionDeadlineAt?: string;
    endAt?: string;
  };
};

type HackathonDisplayStatus = {
  code: HackathonDisplayStatusCode;
  baseCode: HackathonBaseStatusCode;
  label: string;
  tone: HackathonStatusTone;
  className: string;
};

const ISO_OFFSET_PATTERN = /(Z|[+\-]\d{2}:\d{2})$/i;

const MANUAL_STATUS_META: Record<
  HackathonOverrideStatusCode,
  Omit<HackathonDisplayStatus, "code">
> = {
  judging: {
    baseCode: "ongoing",
    label: "\uC2EC\uC0AC\uC911",
    tone: "pending",
    className: "status-chip status-chip--pending",
  },
  extended: {
    baseCode: "ongoing",
    label: "\uC811\uC218\uC5F0\uC7A5",
    tone: "pending",
    className: "status-chip status-chip--pending",
  },
  closed_early: {
    baseCode: "ended",
    label: "\uC870\uAE30\uC885\uB8CC",
    tone: "closed",
    className: "status-chip status-chip--closed",
  },
  private: {
    baseCode: "ended",
    label: "\uBE44\uACF5\uAC1C",
    tone: "closed",
    className: "status-chip status-chip--closed",
  },
  paused: {
    baseCode: "ongoing",
    label: "\uC77C\uC2DC\uC911\uB2E8",
    tone: "pending",
    className: "status-chip status-chip--pending",
  },
};

const BASE_STATUS_META: Record<HackathonBaseStatusCode, Omit<HackathonDisplayStatus, "code" | "baseCode">> = {
  scheduled: {
    label: "\uC608\uC815",
    tone: "upcoming",
    className: "status-chip status-chip--upcoming",
  },
  ongoing: {
    label: "\uC9C4\uD589\uC911",
    tone: "ongoing",
    className: "status-chip status-chip--ongoing",
  },
  ended: {
    label: "\uC885\uB8CC",
    tone: "ended",
    className: "status-chip status-chip--ended",
  },
};

function getDefaultOffsetForTimezone(timezone?: string) {
  if (!timezone || timezone === DEFAULT_HACKATHON_TIMEZONE) {
    return "+09:00";
  }

  return "Z";
}

function parseDateTime(value?: string, timezone?: string) {
  if (!value) return null;

  const normalized = ISO_OFFSET_PATTERN.test(value)
    ? value
    : value.includes("T")
      ? `${value}${getDefaultOffsetForTimezone(timezone)}`
      : `${value}T00:00:00${getDefaultOffsetForTimezone(timezone)}`;

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getLegacyFallbackStatus(status?: HackathonStatusLike["status"]): HackathonBaseStatusCode {
  if (status === "ongoing") return "ongoing";
  if (status === "ended") return "ended";
  return "scheduled";
}

export function getHackathonDisplayStatus(
  hackathon: HackathonStatusLike,
  now: number | Date = Date.now()
): HackathonDisplayStatus {
  if (hackathon.statusMode === "manual" && hackathon.statusOverride) {
    return {
      code: hackathon.statusOverride,
      ...MANUAL_STATUS_META[hackathon.statusOverride],
    };
  }

  const currentTime = now instanceof Date ? now.getTime() : now;
  const timezone = hackathon.period?.timezone ?? DEFAULT_HACKATHON_TIMEZONE;
  const startAt = parseDateTime(hackathon.period?.startAt, timezone);
  const endAt = parseDateTime(hackathon.period?.endAt, timezone);

  let baseCode: HackathonBaseStatusCode;

  if (startAt !== null && currentTime < startAt) {
    baseCode = "scheduled";
  } else if (endAt !== null && currentTime >= endAt) {
    baseCode = "ended";
  } else if (startAt !== null) {
    baseCode = "ongoing";
  } else if (endAt !== null) {
    baseCode = currentTime >= endAt ? "ended" : "ongoing";
  } else {
    baseCode = getLegacyFallbackStatus(hackathon.status);
  }

  return {
    code: baseCode,
    baseCode,
    ...BASE_STATUS_META[baseCode],
  };
}

export function getHackathonFilterStatusCode(
  hackathon: HackathonStatusLike,
  now: number | Date = Date.now()
) {
  return getHackathonDisplayStatus(hackathon, now).baseCode;
}
