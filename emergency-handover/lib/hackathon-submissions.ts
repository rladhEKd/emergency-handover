"use client";

export type SubmissionInputMode = "memo" | "text" | "url" | "file";
export type SubmissionFileType = "zip" | "pdf" | "csv";

export type SubmissionItemSource = {
  key: string;
  title: string;
  format: string;
  inputModes?: SubmissionInputMode[];
  allowedFileTypes?: SubmissionFileType[];
  deadlineAt?: string;
  required?: boolean;
};

export type SubmissionItemConfig = {
  key: string;
  title: string;
  format: string;
  inputModes: SubmissionInputMode[];
  allowedFileTypes: SubmissionFileType[];
  deadlineAt: string;
  required: boolean;
  accept: string;
};

type ScheduleMilestone = {
  name: string;
  at: string;
};

export const MAX_SUBMISSION_FILE_SIZE = 20 * 1024 * 1024;

const FILE_ACCEPT_MAP: Record<SubmissionFileType, string[]> = {
  zip: [".zip", "application/zip", "application/x-zip-compressed"],
  pdf: [".pdf", "application/pdf"],
  csv: [".csv", "text/csv", "application/csv"],
};

function inferInputModes(item: SubmissionItemSource, fallbackFileTypes: SubmissionFileType[]) {
  if (item.inputModes && item.inputModes.length > 0) {
    return item.inputModes as SubmissionInputMode[];
  }

  if (item.format === "url") return ["url"] as SubmissionInputMode[];
  if (item.format === "text") return ["memo"] as SubmissionInputMode[];
  if (item.format === "text_or_url") return ["memo", "url"] as SubmissionInputMode[];
  if (item.format === "pdf_url") {
    return (fallbackFileTypes.includes("pdf") ? ["file", "memo"] : ["url", "memo"]) as SubmissionInputMode[];
  }
  if (fallbackFileTypes.length > 0) return ["file"] as SubmissionInputMode[];
  return ["memo"] as SubmissionInputMode[];
}

function normalizeFileTypes(item: SubmissionItemSource, fallbackTypes: string[]) {
  const explicit = item.allowedFileTypes?.filter(Boolean) ?? [];
  if (explicit.length > 0) return explicit;

  const inferred = fallbackTypes.filter((type): type is SubmissionFileType =>
    type === "zip" || type === "pdf" || type === "csv"
  );

  if (item.format === "pdf_url" && !inferred.includes("pdf")) {
    inferred.push("pdf");
  }

  return inferred;
}

function buildAccept(fileTypes: SubmissionFileType[]) {
  return fileTypes.flatMap((type) => FILE_ACCEPT_MAP[type] ?? []).join(",");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function findItemDeadlineFromSchedule(item: SubmissionItemSource, milestones: ScheduleMilestone[]) {
  const title = normalizeText(item.title);
  const key = normalizeText(item.key);

  const exactMatch = milestones.find((milestone) => {
    const normalized = normalizeText(milestone.name);
    if (key === "plan") return normalized.includes("기획") || normalized.includes("접수");
    if (key === "web") return normalized.includes("웹") || normalized.includes("링크");
    if (key === "pdf") return normalized.includes("pdf");
    if (title.includes("기획") || title.includes("접수")) return normalized.includes("기획") || normalized.includes("접수");
    if (title.includes("웹") || title.includes("링크")) return normalized.includes("웹") || normalized.includes("링크");
    if (title.includes("pdf")) return normalized.includes("pdf");
    return false;
  });

  return exactMatch?.at;
}

export function buildSubmissionConfigs(input: {
  submissionItems?: SubmissionItemSource[];
  allowedArtifactTypes?: string[];
  submissionDeadlineAt: string;
  scheduleMilestones?: ScheduleMilestone[];
}) {
  const fallbackTypes = (input.allowedArtifactTypes ?? []).filter(Boolean);
  const milestones = input.scheduleMilestones ?? [];
  const sourceItems =
    input.submissionItems && input.submissionItems.length > 0
      ? input.submissionItems
      : [
          {
            key: "default",
            title: "기본 제출",
            format: fallbackTypes.includes("url") ? "url" : fallbackTypes.length > 0 ? "file" : "text",
          },
        ];

  return sourceItems.map<SubmissionItemConfig>((item) => {
    const allowedFileTypes = normalizeFileTypes(item, fallbackTypes);
    const inputModes = inferInputModes(item, allowedFileTypes);
    const deadlineAt =
      item.deadlineAt ||
      findItemDeadlineFromSchedule(item, milestones) ||
      input.submissionDeadlineAt;

    return {
      key: item.key,
      title: item.title,
      format: item.format,
      inputModes,
      allowedFileTypes,
      deadlineAt,
      required: item.required ?? true,
      accept: buildAccept(allowedFileTypes),
    };
  });
}

export function isDeadlineClosed(deadlineAt: string) {
  return new Date(deadlineAt).getTime() < Date.now();
}

export function getSubmissionStatusLabel(hasSubmission: boolean, deadlineClosed: boolean) {
  if (deadlineClosed && hasSubmission) return "제출 완료";
  if (deadlineClosed) return "마감됨";
  if (hasSubmission) return "수정 가능";
  return "미제출";
}

export function matchesAllowedFileType(file: File, allowedFileTypes: SubmissionFileType[]) {
  if (allowedFileTypes.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const mimeType = file.type.toLowerCase();

  return allowedFileTypes.some((type) =>
    (FILE_ACCEPT_MAP[type] ?? []).some((accept) => {
      const normalized = accept.toLowerCase();
      if (normalized.startsWith(".")) return fileName.endsWith(normalized);
      return mimeType === normalized;
    })
  );
}

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
