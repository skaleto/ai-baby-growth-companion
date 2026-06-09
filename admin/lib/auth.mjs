// admin/lib/auth.mjs
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");

const attempts = new Map(); // ip -> { count, resetAt }
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 10;
export function resetThrottle() { attempts.clear(); }

function throttled(ip, now) {
  const e = attempts.get(ip);
  if (!e || now > e.resetAt) { attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS }); return false; }
  return e.count >= MAX_PER_WINDOW;
}
function recordFailure(ip, now) {
  const e = attempts.get(ip) || { count: 0, resetAt: now + WINDOW_MS };
  e.count += 1; attempts.set(ip, e);
}

function timingSafeEqual(a, b) {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function sign(payloadB64, secret) {
  return b64u(crypto.createHmac("sha256", secret).update(payloadB64).digest());
}

export function login(phone, password, ip, cfg, now = Date.now()) {
  if (throttled(ip, now)) return { ok: false, error: "尝试过于频繁,请稍后再试。" };
  const okPhone = cfg.adminPhones.includes(String(phone || "").trim());
  const okPass = timingSafeEqual(String(password || ""), cfg.adminPassword);
  if (!okPhone || !okPass) { recordFailure(ip, now); return { ok: false, error: "手机号或密码不正确。" }; }
  const payload = b64u(JSON.stringify({ phone: String(phone).trim(), exp: now + cfg.tokenTtlMs }));
  return { ok: true, token: `${payload}.${sign(payload, cfg.tokenSecret)}` };
}

export function verifyToken(token, cfg, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return null;
  if (!timingSafeEqual(sig, sign(payloadB64, cfg.tokenSecret))) return null;
  let data; try { data = JSON.parse(fromB64u(payloadB64).toString()); } catch { return null; }
  if (!data || typeof data.exp !== "number" || now > data.exp) return null;
  if (!cfg.adminPhones.includes(data.phone)) return null;
  return { phone: data.phone };
}
