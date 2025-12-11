/* ===== Guard: must be admin ===== */
const user = JSON.parse(localStorage.getItem("user") || "{}");
const token = localStorage.getItem("token") || "";
if (!user?.roles?.includes("admin")) {
  window.location.href = "/views/role-select.html";
}

/* ===== Header ===== */
const adminNameEl = document.getElementById("adminName");
if (adminNameEl) adminNameEl.textContent = user?.name ? `Hi, ${user.name}` : "Admin";
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "/views/auth.html";
});

/* ===== Sidebar (S1) + Mobile slide-over (MB1) ===== */
const sidebar = document.getElementById("sidebar");
document.getElementById("mobileMenuBtn")?.addEventListener("click", () => sidebar.classList.add("open"));
document.getElementById("sidebarClose")?.addEventListener("click", () => sidebar.classList.remove("open"));

/* ===== View switching (left sidebar) ===== */
const viewBtns = Array.from(document.querySelectorAll(".nav-btn"));
const views = {
  overview: document.getElementById("view-overview"),
  sellers: document.getElementById("view-sellers"),
  buyers: document.getElementById("view-buyers"),
  revenue: document.getElementById("view-revenue"),
  info: document.getElementById("view-info"),
};
function setView(key) {
  viewBtns.forEach(b => b.classList.toggle("active", b.dataset.view === key));
  Object.entries(views).forEach(([k, el]) => el.classList.toggle("active", k === key));
  sidebar.classList.remove("open"); // close on mobile
  // load specific data if needed
  if (key === "sellers") loadSellersPage();
  if (key === "buyers") loadBuyersPage();
  if (key === "revenue") loadRevenue();
  if (key === "info") loadInfo();
}
viewBtns.forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
// default
setView("overview");

/* ===== Overview mini-tabs (B + D) ===== */
const tabsWrap = document.getElementById("miniTabs");
const indicator = document.getElementById("miniIndicator");
const miniBtns = Array.from(document.querySelectorAll(".mini-tab"));
const miniPanels = {
  "ovr-stats": document.getElementById("ovr-stats"),
  "ovr-sellers": document.getElementById("ovr-sellers"),
  "ovr-buyers": document.getElementById("ovr-buyers"),
  "ovr-revenue": document.getElementById("ovr-revenue"),
  "ovr-info": document.getElementById("ovr-info"),
};
function moveIndicator(btn) {
  const r = btn.getBoundingClientRect();
  const p = tabsWrap.getBoundingClientRect();
  indicator.style.left = (r.left - p.left) + "px";
  indicator.style.width = r.width + "px";
}
function setMini(key) {
  miniBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
  Object.entries(miniPanels).forEach(([k, el]) => el.classList.toggle("active", k === key));
  const activeBtn = miniBtns.find(b => b.dataset.tab === key);
  if (activeBtn) moveIndicator(activeBtn);
}
miniBtns.forEach(b => b.addEventListener("click", () => setMini(b.dataset.tab)));
window.addEventListener("resize", () => {
  const activeBtn = miniBtns.find(b => b.classList.contains("active"));
  if (activeBtn) moveIndicator(activeBtn);
});
setMini("ovr-stats");

/* ===== API helper ===== */
const API = "http://localhost:5000";
async function api(path, opts = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error((await res.json()).error || "Request failed");
  return res.json();
}
function toast(t) {
  const el = document.getElementById("toast");
  el.textContent = t;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

/* ===== Render helpers ===== */
const $ = s => document.querySelector(s);
function renderList(el, items, kind) {
  el.innerHTML = "";
  if (!items?.length) {
    el.innerHTML = `<div class="muted">No ${kind}.</div>`;
    return;
  }
  for (const it of items) {
    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="left">
        <div class="badge">${it.role || it.plan || "user"}</div>
        <div>
          <div><strong>${it.name || "—"}</strong></div>
          <div class="muted" style="font-size:12px">${it.email || ""}</div>
        </div>
      </div>
      <div class="right">
        ${it.upgradable ? `<button class="btn-primary" data-upgrade="${it.id}">Upgrade</button>` : ""}
      </div>
    `;
    el.appendChild(row);
  }
  el.querySelectorAll("[data-upgrade]").forEach(btn => {
    btn.addEventListener("click", async () => {
      try {
        await api(`/api/admin/upgrade/${btn.dataset.upgrade}`, { method: "PATCH" });
        toast("Seller upgraded ✅");
        loadSellers(); loadSellersPage();
      } catch (e) { toast(e.message) }
    });
  });
}

/* ===== Loaders: Overview mini-tabs ===== */
async function loadOverview() {
  try {
    const data = await api("/api/admin/stats"); // { users, sellers, buyers, products }
    $("#kpiUsers").textContent = data.users ?? "—";
    $("#kpiSellers").textContent = data.sellers ?? "—";
    $("#kpiBuyers").textContent = data.buyers ?? "—";
    $("#kpiProducts").textContent = data.products ?? "—";
  } catch {
    $("#kpiUsers").textContent = "1204";
    $("#kpiSellers").textContent = "143";
    $("#kpiBuyers").textContent = "1061";
    $("#kpiProducts").textContent = "3820";
  }
}
async function loadSellers() {
  try {
    const data = await api("/api/admin/sellers"); // { paid, unpaid, online }
    renderList($("#listPaid"), data.paid, "paid sellers");
    renderList($("#listUnpaid"), (data.unpaid || []).map(u => ({ ...u, upgradable: true })), "unpaid sellers");
    renderList($("#listSellersOnline"), data.online, "online sellers");
  } catch {
    renderList($("#listPaid"), [{ id: "1", name: "Asha Store", email: "asha@shop.tz", role: "paid" }], "paid sellers");
    renderList($("#listUnpaid"), [{ id: "2", name: "Juma Tech", email: "juma@shop.tz", role: "unpaid", upgradable: true }], "unpaid sellers");
    renderList($("#listSellersOnline"), [{ id: "3", name: "Kefa Wear", email: "kefa@shop.tz", role: "online" }], "online sellers");
  }
}
async function loadBuyers() {
  try {
    const data = await api("/api/admin/buyers"); // { online, all }
    renderList($("#listBuyersOnline"), data.online, "online buyers");
    renderList($("#listAllBuyers"), data.all, "buyers");
  } catch {
    renderList($("#listBuyersOnline"), [{ id: "b1", name: "Neema", email: "neema@user.tz" }], "online buyers");
    renderList($("#listAllBuyers"), [{ id: "b2", name: "Peter", email: "peter@user.tz" }], "buyers");
  }
}
async function loadRevenue() {
  try {
    const data = await api("/api/admin/revenue"); // { total }
    document.getElementById("revTotal").textContent = data.total || "TSh —";
    document.getElementById("revTotal2").textContent = data.total || "TSh —";
  } catch {
    document.getElementById("revTotal").textContent = "TSh 0 (demo)";
    document.getElementById("revTotal2").textContent = "TSh 0 (demo)";
  }
}
async function loadInfo() {
  try {
    const data = await api("/api/admin/info"); // { reports, signups }
    renderList($("#listReports"), data.reports, "reports");
    renderList($("#listSignups"), data.signups, "today signups");
    renderList($("#pageReports"), data.reports, "reports");
    renderList($("#pageSignups"), data.signups, "today signups");
  } catch {
    renderList($("#listReports"), [{ id: "r1", name: "Report #001" }], "reports");
    renderList($("#listSignups"), [{ id: "s1", name: "Maria", email: "maria@user.tz" }], "today signups");
    renderList($("#pageReports"), [{ id: "r1", name: "Report #001" }], "reports");
    renderList($("#pageSignups"), [{ id: "s1", name: "Maria", email: "maria@user.tz" }], "today signups");
  }
}

/* ===== Page-level lists ===== */
async function loadSellersPage() {
  try {
    const data = await api("/api/admin/sellers");
    renderList($("#pagePaid"), data.paid, "paid sellers");
    renderList($("#pageUnpaid"), (data.unpaid || []).map(u => ({ ...u, upgradable: true })), "unpaid sellers");
    renderList($("#pageSellersOnline"), data.online, "online sellers");
  } catch {
    renderList($("#pagePaid"), [{ id: "1", name: "Asha Store", email: "asha@shop.tz", role: "paid" }], "paid sellers");
    renderList($("#pageUnpaid"), [{ id: "2", name: "Juma Tech", email: "juma@shop.tz", role: "unpaid", upgradable: true }], "unpaid sellers");
    renderList($("#pageSellersOnline"), [{ id: "3", name: "Kefa Wear", email: "kefa@shop.tz", role: "online" }], "online sellers");
  }
}
async function loadBuyersPage() {
  try {
    const data = await api("/api/admin/buyers");
    renderList($("#pageBuyersOnline"), data.online, "online buyers");
    renderList($("#pageAllBuyers"), data.all, "buyers");
  } catch {
    renderList($("#pageBuyersOnline"), [{ id: "b1", name: "Neema", email: "neema@user.tz" }], "online buyers");
    renderList($("#pageAllBuyers"), [{ id: "b2", name: "Peter", email: "peter@user.tz" }], "buyers");
  }
}

/* ===== Initial loads ===== */
loadOverview();
loadSellers();
loadBuyers();
loadRevenue();
loadInfo();

/* ===== Optional Socket.IO online tracking ===== */
try {
  const socket = io("http://localhost:5000", { transports: ["websocket", "polling"] });
  socket.on("connect", () => {/* connected */ });
  // If you emit live online counts from server, handle them here
  // socket.on("onlineCounts", data => { ...update lists/kpis... });
} catch {/* ignore if not present */ }
