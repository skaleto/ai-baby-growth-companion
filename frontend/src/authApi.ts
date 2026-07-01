const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_AGENT_API_BASE_URL ?? "http://localhost:8080");

const AUTH_TOKEN_KEY = "baby-companion-auth-token";

export interface AuthUser {
  id: string;
  /** Masked phone for display only (e.g. 138****8888); the API never returns the full number. */
  phone: string;
  /** Explicit masked phone field (REQ-AUTH-004); equals {@link phone}. */
  maskedPhone?: string;
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
  existingMember: boolean;
  member?: AuthMember | null;
}

export interface UpdateFamilyRequest {
  name: string;
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

export const REQUEST_ID_HEADER = "X-Request-Id";

export function createRequestId(prefix = "web") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function apiLogPath(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    return new URL(raw).pathname;
  } catch {
    return raw;
  }
}

export const AUTH_EXPIRED_EVENT = "baby-companion-auth-expired";

function dispatchAuthExpired(reason: "401" | "manual") {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
  } catch {
    // Custom events are best-effort; ignore environments without dispatchEvent.
  }
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const requestId = headers.get(REQUEST_ID_HEADER) || createRequestId();
  headers.set(REQUEST_ID_HEADER, requestId);
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const path = apiLogPath(input);
  const startedAt = performance.now();
  console.info("[api] ->", { requestId, method, path });
  try {
    const response = await fetch(input, { ...init, headers });
    const responseRequestId = response.headers.get(REQUEST_ID_HEADER) || requestId;
    const durationMs = Math.round(performance.now() - startedAt);
    const logger = response.ok ? console.info : console.warn;
    logger("[api] <-", { requestId: responseRequestId, method, path, status: response.status, durationMs });
    // 只有"确实带了 Authorization token"的请求收到 401 才算会话失效。
    // 预鉴权端点(login、invite/roles 等)不带 token,它们的 401 是业务错误(如邀请码不正确),
    // 必须交给调用方 .catch 处理,绝不能误当会话过期去 clearAuthToken + 踢回登录(会清掉秒开缓存/token)。
    // 之前按 path 只豁免了 /api/auth/login,漏掉了 invite/roles——用"是否带 Authorization 头"判定更通用、更正确。
    const carriedAuthToken = headers.has("Authorization");
    if (response.status === 401 && carriedAuthToken) {
      clearAuthToken();
      dispatchAuthExpired("401");
    }
    return response;
  } catch (error) {
    console.warn("[api] xx", {
      requestId,
      method,
      path,
      durationMs: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function parseError(response: Response, fallback: string) {
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
  roleName?: string,
  caregiver?: boolean | null,
): Promise<AuthLoginResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, inviteCode, roleName, caregiver }),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录失败，请稍后再试。"));
  const payload = (await response.json()) as AuthLoginResponse;
  setAuthToken(payload.accessToken);
  return payload;
}

export async function readInviteRoleOptions(inviteCode: string, phone?: string, signal?: AbortSignal): Promise<InviteRoleOptionsResponse> {
  const params = new URLSearchParams({ inviteCode });
  if (phone) params.set("phone", phone);
  const response = await apiFetch(`${apiBaseUrl}/api/auth/invite/roles?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(await parseError(response, "邀请码暂时无法确认，请稍后再试。"));
  return (await response.json()) as InviteRoleOptionsResponse;
}

export async function readCurrentUser(): Promise<AuthMeResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/me`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录已失效，请重新登录。"));
  return (await response.json()) as AuthMeResponse;
}

export async function updateFamilyName(name: string): Promise<AuthFamily> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/family`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name } satisfies UpdateFamilyRequest),
  });
  if (!response.ok) throw new Error(await parseError(response, "家庭名称保存失败，请稍后再试。"));
  return (await response.json()) as AuthFamily;
}

export async function logoutCurrentUser() {
  await apiFetch(`${apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => undefined);
  clearAuthToken();
  dispatchAuthExpired("manual");
}

export async function refreshAccessToken(): Promise<AuthLoginResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/refresh`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "登录已失效，请重新登录。"));
  const payload = (await response.json()) as AuthLoginResponse;
  setAuthToken(payload.accessToken);
  return payload;
}

// ---- 家庭成员管理（REQ-AUTH, R1）----

export interface FamilyMember {
  userId: string;
  roleName: string;
  caregiver: boolean;
  /** 已脱敏手机号，仅用于识别成员，例如 138****8888。 */
  maskedPhone: string;
  lastSeenAt?: string | null;
  /** 是否当前登录用户，前端据此禁用"移除自己/撤销自己权限"。 */
  self: boolean;
}

export interface FamilyMembersResponse {
  members: FamilyMember[];
  canManage: boolean;
}

export async function readFamilyMembers(): Promise<FamilyMembersResponse> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/family/members`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "家庭成员加载失败，请稍后再试。"));
  return (await response.json()) as FamilyMembersResponse;
}

export async function removeFamilyMember(userId: string): Promise<void> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/family/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "移除成员失败，请稍后再试。"));
}

export async function updateFamilyMemberCaregiver(userId: string, caregiver: boolean): Promise<FamilyMember> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/family/members/${encodeURIComponent(userId)}/caregiver`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ caregiver }),
  });
  if (!response.ok) throw new Error(await parseError(response, "权限调整失败，请稍后再试。"));
  return (await response.json()) as FamilyMember;
}

export async function resetFamilyInviteCode(): Promise<{ inviteCode: string }> {
  const response = await apiFetch(`${apiBaseUrl}/api/auth/family/invite-code/reset`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(await parseError(response, "重置邀请码失败，请稍后再试。"));
  return (await response.json()) as { inviteCode: string };
}
