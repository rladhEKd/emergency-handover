"use client";

export const DIRECT_MESSAGE_THREADS_KEY = "direct-message-threads-v1";
export const DIRECT_MESSAGE_MESSAGES_KEY = "direct-message-messages-v1";
export const DIRECT_MESSAGES_CHANGED_EVENT = "direct-messages-changed";

export type DirectMessageThread = {
  id: string;
  participantIds: [string, string];
  participantNicknames: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  lastMessageId: string | null;
  teamCode?: string;
  teamName?: string;
};

export type DirectMessage = {
  id: string;
  threadId: string;
  senderId: string;
  senderNickname: string;
  receiverId: string;
  receiverNickname: string;
  title?: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type DirectMessageThreadSummary = {
  thread: DirectMessageThread;
  otherUserId: string;
  otherNickname: string;
  lastMessage: DirectMessage | null;
  unreadCount: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function safeParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeUserId(value: string) {
  return value.trim();
}

function decodeEscapedUnicode(value: string | null | undefined) {
  if (!value) return "";
  return String(value).replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function isBrokenPlaceholder(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  return normalized === "?" || normalized === "??" || normalized === "???" || normalized.includes("?");
}

function sanitizeNickname(value: string | null | undefined, fallback = "Member") {
  const decoded = decodeEscapedUnicode(value);
  const normalized = decoded.trim();
  if (!normalized || isBrokenPlaceholder(normalized)) {
    return fallback;
  }
  return normalized;
}

export function normalizeParticipantIds(userA: string, userB: string): [string, string] {
  const normalized = [normalizeUserId(userA), normalizeUserId(userB)].sort();
  return [normalized[0], normalized[1]];
}

export function getDirectMessageThreadId(userA: string, userB: string) {
  const [first, second] = normalizeParticipantIds(userA, userB);
  return `dm-${first}--${second}`;
}

export function readDirectMessageThreads() {
  if (!isBrowser()) return [] as DirectMessageThread[];

  const threads = safeParseArray<DirectMessageThread>(window.localStorage.getItem(DIRECT_MESSAGE_THREADS_KEY));
  let changed = false;

  const normalizedThreads = threads.map((thread) => {
    const participantNicknames = Object.fromEntries(
      Object.entries(thread.participantNicknames ?? {}).map(([id, nickname]) => {
        const sanitizedNickname = sanitizeNickname(nickname);
        if (sanitizedNickname !== nickname) changed = true;
        return [id, sanitizedNickname];
      })
    );

    return {
      ...thread,
      participantNicknames,
    };
  });

  if (changed) {
    writeDirectMessageThreads(normalizedThreads);
  }

  return normalizedThreads;
}

export function readDirectMessages() {
  if (!isBrowser()) return [] as DirectMessage[];

  const messages = safeParseArray<DirectMessage>(window.localStorage.getItem(DIRECT_MESSAGE_MESSAGES_KEY));
  let changed = false;

  const normalizedMessages = messages.map((message) => {
    const senderNickname = sanitizeNickname(message.senderNickname);
    const receiverNickname = sanitizeNickname(message.receiverNickname);
    const title = message.title ? decodeEscapedUnicode(message.title) : "";
    const body = decodeEscapedUnicode(message.body);

    if (
      senderNickname !== message.senderNickname ||
      receiverNickname !== message.receiverNickname ||
      title !== (message.title ?? "") ||
      body !== message.body
    ) {
      changed = true;
    }

    return {
      ...message,
      senderNickname,
      receiverNickname,
      title: title || undefined,
      body,
    };
  });

  if (changed) {
    writeDirectMessages(normalizedMessages);
  }

  return normalizedMessages;
}

function writeDirectMessageThreads(threads: DirectMessageThread[]) {
  window.localStorage.setItem(DIRECT_MESSAGE_THREADS_KEY, JSON.stringify(threads));
}

function writeDirectMessages(messages: DirectMessage[]) {
  window.localStorage.setItem(DIRECT_MESSAGE_MESSAGES_KEY, JSON.stringify(messages));
}

export function notifyDirectMessagesChanged() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(DIRECT_MESSAGES_CHANGED_EVENT));
}

export function findDirectMessageThreadBetweenUsers(userA: string, userB: string) {
  const threadId = getDirectMessageThreadId(userA, userB);
  return readDirectMessageThreads().find((thread) => thread.id == threadId) ?? null;
}

export function getDirectMessageThreadById(threadId: string) {
  return readDirectMessageThreads().find((thread) => thread.id == threadId) ?? null;
}

export function getDirectMessageOtherParticipant(thread: DirectMessageThread, currentUserId: string) {
  return thread.participantIds.find((participantId) => participantId !== currentUserId) ?? null;
}

export function ensureDirectMessageThread(input: {
  currentUserId: string;
  currentUserNickname: string;
  otherUserId: string;
  otherUserNickname: string;
  teamCode?: string;
  teamName?: string;
}) {
  const threadId = getDirectMessageThreadId(input.currentUserId, input.otherUserId);
  const [firstUserId, secondUserId] = normalizeParticipantIds(input.currentUserId, input.otherUserId);
  const threads = readDirectMessageThreads();
  const existing = threads.find((thread) => thread.id === threadId);
  const now = new Date().toISOString();

  if (existing) {
    const nextThread: DirectMessageThread = {
      ...existing,
      participantNicknames: {
        ...existing.participantNicknames,
        [input.currentUserId]: input.currentUserNickname,
        [input.otherUserId]: input.otherUserNickname,
      },
      teamCode: input.teamCode ?? existing.teamCode,
      teamName: input.teamName ?? existing.teamName,
    };

    writeDirectMessageThreads(threads.map((thread) => (thread.id === threadId ? nextThread : thread)));
    notifyDirectMessagesChanged();
    return nextThread;
  }

  const nextThread: DirectMessageThread = {
    id: threadId,
    participantIds: [firstUserId, secondUserId],
    participantNicknames: {
      [input.currentUserId]: input.currentUserNickname,
      [input.otherUserId]: input.otherUserNickname,
    },
    createdAt: now,
    updatedAt: now,
    lastMessageId: null,
    teamCode: input.teamCode,
    teamName: input.teamName,
  };

  writeDirectMessageThreads([nextThread, ...threads]);
  notifyDirectMessagesChanged();
  return nextThread;
}

export function sendDirectMessage(input: {
  currentUserId: string;
  currentUserNickname: string;
  otherUserId: string;
  otherUserNickname: string;
  body: string;
  title?: string;
  threadId?: string;
  teamCode?: string;
  teamName?: string;
}) {
  const senderId = normalizeUserId(input.currentUserId);
  const receiverId = normalizeUserId(input.otherUserId);
  const body = input.body.trim();
  const title = input.title?.trim() ?? "";

  if (!senderId || !receiverId || senderId === receiverId || !body) {
    return null;
  }

  const thread =
    (input.threadId ? getDirectMessageThreadById(input.threadId) : null) ??
    ensureDirectMessageThread({
      currentUserId: senderId,
      currentUserNickname: input.currentUserNickname,
      otherUserId: receiverId,
      otherUserNickname: input.otherUserNickname,
      teamCode: input.teamCode,
      teamName: input.teamName,
    });

  const messages = readDirectMessages();
  const now = new Date().toISOString();
  const nextMessage: DirectMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    threadId: thread.id,
    senderId,
    senderNickname: input.currentUserNickname,
    receiverId,
    receiverNickname: input.otherUserNickname,
    title: title || undefined,
    body,
    createdAt: now,
    readAt: null,
  };

  const nextMessages = [...messages, nextMessage];
  const nextThreads = readDirectMessageThreads().map((item) =>
    item.id === thread.id
      ? {
          ...item,
          participantNicknames: {
            ...item.participantNicknames,
            [senderId]: input.currentUserNickname,
            [receiverId]: input.otherUserNickname,
          },
          updatedAt: now,
          lastMessageId: nextMessage.id,
          teamCode: input.teamCode ?? item.teamCode,
          teamName: input.teamName ?? item.teamName,
        }
      : item
  );

  writeDirectMessages(nextMessages);
  writeDirectMessageThreads(nextThreads);
  notifyDirectMessagesChanged();

  return { thread: nextThreads.find((item) => item.id === thread.id) ?? thread, message: nextMessage };
}

export function getThreadMessages(threadId: string) {
  return readDirectMessages()
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function markThreadAsRead(threadId: string, currentUserId: string) {
  const messages = readDirectMessages();
  const now = new Date().toISOString();
  let changed = false;

  const nextMessages = messages.map((message) => {
    if (message.threadId !== threadId || message.receiverId !== currentUserId || message.readAt) {
      return message;
    }

    changed = true;
    return {
      ...message,
      readAt: now,
    };
  });

  if (!changed) return false;

  writeDirectMessages(nextMessages);
  notifyDirectMessagesChanged();
  return true;
}

export function listDirectMessageThreadSummaries(currentUserId: string) {
  const userId = normalizeUserId(currentUserId);
  if (!userId) return [] as DirectMessageThreadSummary[];

  const threads = readDirectMessageThreads().filter((thread) => thread.participantIds.includes(userId));
  const messages = readDirectMessages();

  return threads
    .map((thread) => {
      const otherUserId = getDirectMessageOtherParticipant(thread, userId) ?? userId;
      const threadMessages = messages.filter((message) => message.threadId === thread.id);
      const lastMessage =
        threadMessages.find((message) => message.id === thread.lastMessageId) ??
        [...threadMessages].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ??
        null;
      const unreadCount = threadMessages.filter(
        (message) => message.receiverId === userId && !message.readAt
      ).length;

      const otherNickname =
        thread.participantNicknames[otherUserId] ||
        (lastMessage?.senderId === otherUserId
          ? lastMessage.senderNickname
          : lastMessage?.receiverId === otherUserId
            ? lastMessage.receiverNickname
            : "Member");

      return {
        thread,
        otherUserId,
        otherNickname,
        lastMessage,
        unreadCount,
      } satisfies DirectMessageThreadSummary;
    })
    .sort((a, b) => new Date(b.thread.updatedAt).getTime() - new Date(a.thread.updatedAt).getTime());
}
