"use client";

export const AUTH_USERS_KEY = "auth-users-v1";
export const AUTH_SESSION_KEY = "auth-session-v1";
export const TEAM_OWNERS_KEY = "team-owners-v1";
export const AUTH_CHANGED_EVENT = "auth-changed";

export type AuthUser = {
  id: string;
  email: string;
  password: string;
  nickname: string;
  createdAt: string;
};

export type AuthSession = {
  userId: string;
  email: string;
  nickname: string;
  loggedInAt: string;
};

export function getStoredUsers(): AuthUser[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(AUTH_USERS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as AuthUser[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveUsers(users: AuthUser[]) {
  window.localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

export function getCurrentSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed?.userId || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getCurrentUser(): AuthUser | null {
  const session = getCurrentSession();
  if (!session) return null;

  return getStoredUsers().find((user) => user.id === session.userId) ?? null;
}

export function isEmailTaken(email: string) {
  const normalized = email.trim().toLowerCase();
  return getStoredUsers().some((user) => user.email.toLowerCase() === normalized);
}

export function signUp(input: {
  email: string;
  password: string;
  nickname: string;
}) {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const nickname = input.nickname.trim();

  if (!email || !password || !nickname) {
    return { ok: false as const, message: "All fields are required." };
  }

  if (!email.includes("@")) {
    return { ok: false as const, message: "Please enter a valid email." };
  }

  if (password.length < 4) {
    return { ok: false as const, message: "Password must be at least 4 characters." };
  }

  if (isEmailTaken(email)) {
    return { ok: false as const, message: "This email is already registered." };
  }

  const user: AuthUser = {
    id: `user-${Date.now()}`,
    email,
    password,
    nickname,
    createdAt: new Date().toISOString(),
  };

  const users = [user, ...getStoredUsers()];
  saveUsers(users);
  setSession(user);

  return { ok: true as const, user };
}

export function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!email || !password) {
    return { ok: false as const, message: "Email and password are required." };
  }

  const user = getStoredUsers().find(
    (item) => item.email.toLowerCase() === email && item.password === password
  );

  if (!user) {
    return { ok: false as const, message: "Email or password is incorrect." };
  }

  setSession(user);
  return { ok: true as const, user };
}

export function logout() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_SESSION_KEY);
  notifyAuthChanged();
}

function setSession(user: AuthUser) {
  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    nickname: user.nickname,
    loggedInAt: new Date().toISOString(),
  };

  window.localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  notifyAuthChanged();
}

export function getTeamOwners() {
  if (typeof window === "undefined") return {} as Record<string, string>;

  try {
    const raw = window.localStorage.getItem(TEAM_OWNERS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTeamOwners(owners: Record<string, string>) {
  window.localStorage.setItem(TEAM_OWNERS_KEY, JSON.stringify(owners));
}

export function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
