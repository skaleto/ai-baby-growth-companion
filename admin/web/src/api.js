const TOKEN_KEY = "admin_token";

export function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
export function setToken(t) { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); }

export function adminPhone() {
  try {
    const payload = getToken().split(".")[0];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).phone || "";
  } catch { return ""; }
}

export async function api(path, opts = {}) {
  const res = await fetch(`/admin-api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) {
    setToken("");
    window.dispatchEvent(new Event("admin-unauth"));
    throw new Error("登录已过期，请重新登录。");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data;
}

export async function login(phone, password) {
  const res = await fetch("/admin-api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "登录失败");
  return data.token;
}
