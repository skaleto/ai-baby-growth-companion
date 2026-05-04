const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8080");

const AUTH_TOKEN_KEY = "baby-companion-auth-token";

export interface AuthUser {
  id: string;
  phone: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AuthFamily {
  id: string;
  name: string;
}

export interface AuthMember {
  roleName: string;
  caregiver: boolean;
}

export interface AuthLoginResponse {
  accessToken: string;
  user: AuthUser;
  family: AuthFamily;
  member: AuthMember;
  onboardingRequired: boolean;
  legacyImportAllowed: boolean;
}

export interface AuthMeResponse {
  user: AuthUser;
  family: AuthFamily;
  member: AuthMember;
  authenticated: boolean;
  onboardingRequired: boolean;
}

export interface InviteRoleOptionsResponse {
  familyName: string;
  occupiedRoles: string[];
  uniqueRoles: string[];
  repeatableRoles: string[];
}

type ApiErrorResponse = {
  code?: string;
  message?: string;
};

export function getAuthToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setAuthToken(token: string) {
  try {
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    // The app still keeps the token in backend responses; storage failure only affects refresh.
  }
}

export function clearAuthToken() {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // Ignore local storage failures.
  }
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function withAuthQuery(url: string) {
  const token = getAuthToken();
  if (!token || !url.startsWith(apiBaseUrl)) return url;
  const parsed = new URL(url);
  parsed.searchParams.set("token", token);
  return parsed.toString();
}

async function parseError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return `${body.code ? `${body.code}: ` : ""}${body.message || fallback}`;
  } catch {
    return fallback;
  }
}

export async function loginWithInvite(
  phone: string,
  inviteCode: string,
  roleName: string,
  caregiver: boolean,
): Promise<AuthLoginResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, inviteCode, roleName, caregiver }),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录失败，请稍后再试。"));
  const payload = (await response.json()) as AuthLoginResponse;
  setAuthToken(payload.accessToken);
  return payload;
}

export async function readInviteRoleOptions(inviteCode: string): Promise<InviteRoleOptionsResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/invite/roles?inviteCode=${encodeURIComponent(inviteCode)}`);
  if (!response.ok) throw new Error(await parseError(response, "邀请码暂时无法确认，请稍后再试。"));
  return (await response.json()) as InviteRoleOptionsResponse;
}

export async function readCurrentUser(): Promise<AuthMeResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录已失效，请重新登录。"));
  return (await response.json()) as AuthMeResponse;
}

export async function logoutCurrentUser() {
  await fetch(`${apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => undefined);
  clearAuthToken();
}
