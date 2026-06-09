const TOKEN_KEY = "admin_token";
let token = sessionStorage.getItem(TOKEN_KEY) || "";
const $ = (s) => document.querySelector(s);
const show = (el, on) => el.classList.toggle("hidden", !on);

async function api(path, opts = {}) {
  const res = await fetch(`/admin-api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  });
  if (res.status === 401) { logout(); throw new Error("登录已过期"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data;
}

function logout() { token = ""; sessionStorage.removeItem(TOKEN_KEY); render(); }

async function doLogin() {
  $("#loginErr").textContent = "";
  try {
    const r = await (await fetch("/admin-api/login", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: $("#phone").value, password: $("#password").value }) })).json();
    if (!r.token) throw new Error(r.error || "登录失败");
    token = r.token; sessionStorage.setItem(TOKEN_KEY, token); render();
  } catch (e) { $("#loginErr").textContent = e.message; }
}

const tabs = {
  async applications(view) {
    const { items } = await api("/applications");
    view.innerHTML = items.length ? "" : "<p>没有待处理的申请。</p>";
    items.forEach((a) => view.append(row(`${a.phone || a.family_id} · ${a.created_at?.slice(0,10)}`, [
      btn("批准", async () => { await api(`/applications/${a.family_id}/approve`, { method: "POST" }); refresh(); }),
      btn("驳回", async () => { await api(`/applications/${a.family_id}/reject`, { method: "POST" }); refresh(); }, "ghost"),
    ])));
  },
  async codes(view) {
    view.innerHTML = `<div class="bar">
      <input id="cnt" type="number" value="20" min="1" max="200" /> 个,每码可用
      <input id="mu" type="number" value="1" min="1" /> 次,
      <input id="exp" type="number" value="30" min="0" /> 天过期
      <button id="genBtn">生成</button></div><pre id="genOut"></pre><div id="codeList"></div>`;
    $("#genBtn").onclick = async () => {
      const r = await api("/redeem-codes", { method: "POST", body: JSON.stringify({
        count: +$("#cnt").value, maxUses: +$("#mu").value, expiresDays: +$("#exp").value }) });
      $("#genOut").textContent = "新生成:\n" + r.codes.join("\n"); loadCodes();
    };
    const loadCodes = async () => {
      const { items } = await api("/redeem-codes");
      $("#codeList").innerHTML = "";
      items.forEach((c) => $("#codeList").append(row(
        `${c.code} · ${c.used_count}/${c.max_uses} · ${c.expires_at ? c.expires_at.slice(0,10) : "永久"}`,
        [btn("停用", async () => { await api(`/redeem-codes/${c.code}/disable`, { method: "POST" }); loadCodes(); }, "ghost")])));
    };
    loadCodes();
  },
  async entitlements(view) {
    view.innerHTML = `<div class="bar"><input id="ph" placeholder="手机号" /><button id="findBtn">查家庭</button></div><div id="famList"></div>`;
    $("#findBtn").onclick = async () => {
      const { items } = await api(`/entitlements/family?phone=${encodeURIComponent($("#ph").value.trim())}`);
      $("#famList").innerHTML = items.length ? "" : "<p>没找到这个手机号对应的家庭。</p>";
      items.forEach((f) => {
        const pro = f.entitlement?.enabled === "true";
        $("#famList").append(row(
          `${f.family_id} · ${f.role_name || ""} · ${pro ? "Pro 至 " + (f.entitlement.expires_at?.slice(0,10) || "永久") : "Free"} · 本月 ${f.usedThisMonth} 次`,
          [ btn(pro ? "续 90 天" : "开通 90 天", async () => { await api("/entitlements", { method: "POST", body: JSON.stringify({ familyId: f.family_id, days: 90 }) }); $("#findBtn").click(); }),
            btn("撤销", async () => { await api(`/entitlements/${f.family_id}/revoke`, { method: "POST" }); $("#findBtn").click(); }, "ghost") ]));
      });
    };
  },
  async usage(view) {
    const o = await api("/overview");
    view.innerHTML = `<div class="stats">
      <div><b>${o.families}</b><span>家庭</span></div>
      <div><b>${o.proFamilies}</b><span>Pro</span></div>
      <div><b>${o.pendingApplications}</b><span>待处理申请</span></div>
      <div><b>${(o.monthlyTokensTotal/1000).toFixed(1)}k</b><span>近30天 token</span></div></div>`;
  },
};

function row(text, actions) {
  const el = document.createElement("div"); el.className = "listrow";
  const span = document.createElement("span"); span.textContent = text; el.append(span);
  const box = document.createElement("div"); actions.forEach((a) => box.append(a)); el.append(box);
  return el;
}
function btn(label, onClick, cls = "") {
  const b = document.createElement("button"); b.textContent = label; if (cls) b.className = cls;
  b.onclick = async () => { b.disabled = true; try { await onClick(); } catch (e) { alert(e.message); } finally { b.disabled = false; } };
  return b;
}

let current = "applications";
async function refresh() {
  try {
    const o = await api("/overview");
    $("#overview").textContent = `家庭 ${o.families} · Pro ${o.proFamilies} · 待办 ${o.pendingApplications}`;
    await tabs[current]($("#view"));
  } catch (e) { /* 401 已处理 */ }
}
function render() {
  const authed = !!token;
  show($("#login"), !authed); show($("#app"), authed);
  if (authed) refresh();
}

document.addEventListener("click", (e) => {
  if (e.target.matches(".tab")) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    e.target.classList.add("active"); current = e.target.dataset.tab; refresh();
  }
});
$("#loginBtn").onclick = doLogin;
$("#password").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
$("#logout").onclick = logout;
render();
