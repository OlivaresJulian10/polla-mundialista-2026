// =====================================================================
//  Polla Mundialista 2026 — Lógica de la aplicación
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { flag, crestUrl } from "./flags.js";

// Escudo (imagen) con respaldo a emoji si no carga
const crest = (team) =>
  `<img class="crest" src="${crestUrl(team)}" alt="" title="${team}" loading="lazy"
        onerror="this.replaceWith(document.createTextNode('${flag(team)}'))" />`;

if (SUPABASE_URL.includes("PEGA_AQUI")) {
  document.body.innerHTML =
    '<div class="loading">⚠️ Falta configurar Supabase.<br>' +
    "Abre <b>js/config.js</b> y pega tu URL y tu clave anon.</div>";
  throw new Error("Configura js/config.js");
}

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Estado en memoria ----
const state = {
  user: null,
  profile: null,
  matches: [],
  myPreds: {}, // match_id -> {pred_home, pred_away}
};

const STAGE_LABELS = {
  group: "Fase de grupos",
  r32: "Dieciseisavos",
  r16: "Octavos",
  qf: "Cuartos de final",
  sf: "Semifinal",
  third: "Tercer puesto",
  final: "Final",
};

// ---- Atajos DOM ----
const $ = (sel) => document.querySelector(sel);
const el = (id) => document.getElementById(id);

// =====================================================================
//  Utilidades
// =====================================================================
function toast(text, kind = "ok") {
  const t = el("toast");
  t.textContent = text;
  t.className = "toast " + kind;
  setTimeout(() => t.classList.add("hidden"), 2600);
}

function fmtDate(iso) {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso);
  const txt = d.toLocaleString("es-CO", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "America/Bogota",
  });
  return txt + " (Col)";
}

// El pronóstico se cierra 10 minutos ANTES del inicio del partido.
const LOCK_MINUTES = 10;
const isLocked = (m) =>
  m.kickoff && new Date(m.kickoff).getTime() - LOCK_MINUTES * 60000 <= Date.now();

// Minuto del partido en vivo. Usa el EXACTO de API-Football (live_minute +
// el tiempo corrido desde que se consultó). Si no hay, cae al aproximado.
function liveMinute(m) {
  if (m.live_minute != null && m.live_minute_at) {
    let min = m.live_minute + Math.floor((Date.now() - new Date(m.live_minute_at).getTime()) / 60000);
    if (min > 130) min = 130;
    return min + "'"; // exacto
  }
  if (!m.kickoff) return "";
  let e = Math.floor((Date.now() - new Date(m.kickoff).getTime()) / 60000);
  if (e < 0) return "0'";
  if (e > 45) e = Math.max(46, e - 15);
  return e >= 90 ? "90+'" : `~${e}'`;
}

// Fecha (YYYY-MM-DD) en hora Colombia, para saber "qué partidos son hoy"
const bogotaYMD = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const todayYMD = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

function pointsFor(pred, m) {
  if (!pred || m.home_score == null || m.away_score == null) return null;
  if (pred.pred_home === m.home_score && pred.pred_away === m.away_score) return 5;
  const a = Math.sign(pred.pred_home - pred.pred_away);
  const b = Math.sign(m.home_score - m.away_score);
  return a === b ? 3 : 0;
}

// =====================================================================
//  Autenticación
// =====================================================================
function showAuthMsg(text, kind = "") {
  const m = el("authMsg");
  m.textContent = text;
  m.className = "msg " + kind;
}

el("msLoginBtn").onclick = async () => {
  showAuthMsg("Redirigiendo a Microsoft…");
  const { error } = await sb.auth.signInWithOAuth({
    provider: "azure",
    options: {
      scopes: "openid email profile",
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) showAuthMsg(traducirError(error.message), "error");
};

el("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

function traducirError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("provider is not enabled"))
    return "El acceso con Microsoft aún no está activado en Supabase (Authentication → Providers → Azure).";
  if (m.includes("redirect"))
    return "Falta autorizar la URL del sitio en Supabase (Authentication → URL Configuration).";
  return msg;
}

// =====================================================================
//  Navegación entre vistas
// =====================================================================
const VIEWS = ["today", "weekend", "matches", "ranking", "admin"];
function showView(name) {
  VIEWS.forEach((v) => el(v + "View").classList.toggle("hidden", v !== name));
  document.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );
  setHeaderH();
  el("syncFab").classList.toggle("hidden", !(name === "admin" && state.profile?.is_admin));
  if (name === "today") renderToday();
  if (name === "weekend") renderWeekend();
  if (name === "matches") renderMatches();
  if (name === "ranking") loadRanking();
  if (name === "admin") renderAdmin();
}

// Mide la altura del encabezado para anclar la barra de guardado debajo
function setHeaderH() {
  const bar = document.querySelector(".topbar");
  if (bar) document.documentElement.style.setProperty("--header-h", bar.offsetHeight + 6 + "px");
}
window.addEventListener("resize", setHeaderH);
document.querySelectorAll("#nav button").forEach((b) => {
  b.onclick = () => showView(b.dataset.view);
});

// =====================================================================
//  Arranque de sesión
// =====================================================================
sb.auth.onAuthStateChange((_event, session) => {
  if (session?.user) start(session.user);
});

(async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session?.user) start(data.session.user);
})();

async function start(user) {
  state.user = user;

  // Cargar perfil (lo crea el trigger al registrarse)
  let { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  state.profile = profile;

  // UI: ocultar login, mostrar app
  el("authView").classList.add("hidden");
  el("nav").classList.remove("hidden");
  el("userBox").classList.remove("hidden");
  el("userName").textContent = profile?.display_name || user.email;
  el("navAdmin").classList.toggle("hidden", !profile?.is_admin);
  renderHeaderAvatar();

  await loadMatchesAndPreds();
  showView("matches");
  startLiveRefresh();
}

// =====================================================================
//  Foto de perfil (avatar)
// =====================================================================
function avatarHtml(url, name) {
  if (url) return `<img class="avatar avatar-sm" src="${url}" alt="" loading="lazy" />`;
  const ini = (name || "?").trim().charAt(0).toUpperCase();
  return `<span class="avatar avatar-sm avatar-fallback">${ini}</span>`;
}

function renderHeaderAvatar() {
  const img = el("userAvatar"), fb = el("userInitial");
  const url = state.profile?.avatar_url;
  const name = state.profile?.display_name || "?";
  if (url) {
    img.src = url; img.classList.remove("hidden"); fb.classList.add("hidden");
  } else {
    img.classList.add("hidden"); fb.classList.remove("hidden");
    fb.textContent = name.trim().charAt(0).toUpperCase();
  }
}

el("avatarBtn").onclick = () => el("avatarInput").click();
el("avatarInput").onchange = (e) => uploadAvatar(e.target.files[0]);

async function uploadAvatar(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("Selecciona una imagen", "error");
  if (file.size > 3 * 1024 * 1024) return toast("Máximo 3 MB", "error");

  toast("Subiendo foto…");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${state.user.id}/avatar.${ext}`;
  const { error: upErr } = await sb.storage
    .from("avatars").upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) return toast("Error al subir: " + upErr.message, "error");

  const { data: { publicUrl } } = sb.storage.from("avatars").getPublicUrl(path);
  const url = publicUrl + "?t=" + Date.now();
  const { error: updErr } = await sb.from("profiles").update({ avatar_url: url }).eq("id", state.user.id);
  if (updErr) return toast("Error al guardar: " + updErr.message, "error");

  state.profile.avatar_url = url;
  renderHeaderAvatar();
  el("avatarInput").value = "";
  toast("Foto actualizada ✅");
}

// =====================================================================
//  Cargar partidos + mis pronósticos
// =====================================================================
async function loadMatchesAndPreds() {
  const { data: matches, error } = await sb
    .from("matches").select("*").order("kickoff", { ascending: true }).order("id");
  if (error) { toast("Error cargando partidos", "error"); return; }
  state.matches = matches || [];

  const { data: preds } = await sb
    .from("predictions").select("*").eq("user_id", state.user.id);
  state.myPreds = {};
  (preds || []).forEach((p) => (state.myPreds[p.match_id] = p));

  renderMatches();
}

// =====================================================================
//  Vista: Mis pronósticos
// =====================================================================
const PHASES = [
  ["group", "⚽ Grupos"], ["r32", "16avos"], ["r16", "Octavos"],
  ["qf", "Cuartos"], ["sf", "Semis"], ["third", "3er puesto"], ["final", "Final"],
];
let phaseFilter = null;

function renderMatches() {
  const cont = el("matchesContainer");
  if (!state.matches.length) {
    cont.innerHTML = '<div class="loading">Aún no hay partidos cargados. (Ejecuta seed.sql)</div>';
    return;
  }

  // Resumen de puntos del usuario (se calcula solo con los resultados ya cargados)
  let total = 0, exactos = 0, aciertos = 0, jugados = 0, pronosticados = 0;
  for (const m of state.matches) {
    const pred = state.myPreds[m.id];
    if (pred) pronosticados++;
    const pts = pointsFor(pred, m);
    if (pts != null) {
      jugados++; total += pts;
      if (pts === 5) exactos++;
      if (pts > 0) aciertos++;
    }
  }

  // Fases disponibles (solo las que tienen partidos)
  const avail = PHASES.filter(([k]) => state.matches.some((m) => m.stage === k));
  // Fase por defecto: la del próximo partido que se juega (o la primera disponible)
  if (phaseFilter === null || !avail.some(([k]) => k === phaseFilter)) {
    const prox = state.matches
      .filter((m) => m.kickoff && new Date(m.kickoff) > new Date())
      .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
    phaseFilter = prox ? prox.stage : (avail[0]?.[0] || "group");
  }

  // Partidos de la fase elegida, agrupados
  const byStage = {};
  for (const m of state.matches) {
    if (m.stage !== phaseFilter) continue;
    const key = m.stage === "group" ? "group:" + m.group_letter : m.stage;
    (byStage[key] ||= []).push(m);
  }

  let html = saveBar("saveAllBtn", "saveHint");
  html += `
    <div class="summary">
      <div class="sum-main"><span class="sum-num">${total}</span><span class="sum-lbl">puntos</span></div>
      <div class="sum-stats">
        <span>🎯 <b>${exactos}</b> exactos</span>
        <span>✅ <b>${aciertos}</b> aciertos</span>
        <span>🏁 <b>${jugados}</b> jugados</span>
        <span>📝 <b>${pronosticados}</b> pronosticados</span>
      </div>
    </div>`;
  html += liveBoxHtml();
  html += `<div class="phase-bar">${avail.map(([k, lbl]) =>
    `<button class="phase-chip ${k === phaseFilter ? "active" : ""}" data-phase="${k}">${lbl}</button>`).join("")}</div>`;
  for (const key of Object.keys(byStage)) {
    const [stage, letter] = key.split(":");
    const title = stage === "group" ? `Grupo ${letter}` : STAGE_LABELS[stage] || stage;
    html += `<div class="group"><div class="group-title">${title}</div>`;
    for (const m of byStage[key]) html += matchRow(m);
    html += `</div>`;
  }
  cont.innerHTML = html;
  wireSave(cont, "saveAllBtn", "saveHint");
  cont.querySelectorAll("[data-phase]").forEach((b) => {
    b.onclick = () => { phaseFilter = b.dataset.phase; renderMatches(); };
  });
}

// Ventanita: partido en juego + próximo a jugar (en Mis pronósticos)
// ¿El partido está en curso? (en vivo según el robot, O ya pasó su hora de
// inicio y no ha terminado — así el 0-0 y el contador arrancan al instante)
function enCurso(m) {
  if (m.status === "live" || m.status === "halftime") return true;
  if (m.status === "finished") return false;
  if (!m.kickoff) return false;
  const el = Date.now() - new Date(m.kickoff).getTime();
  return el >= 0 && el < 2.5 * 3600 * 1000; // dentro de ~2.5h desde el inicio
}

const _box = (n) => `<span class="lb-box">${n ?? ""}</span>`;
const _boxes = (h, a, cls = "") =>
  `<span class="lb-boxes ${cls}">${_box(h)}<span class="lb-x">-</span>${_box(a)}</span>`;

function liveCard(m) {
  const min = m.status === "halftime" ? "⏸️ Entretiempo" : "🔴 " + liveMinute(m);
  const p = state.myPreds[m.id];
  let cmp = "";
  if (p) { const pts = pointsFor(p, m); cmp = pts === 5 ? "🎯 ¡exacto!" : pts === 3 ? "✅ vas acertando" : "⏳ aún no suma"; }
  return `<div class="lb-card lb-card-live lb-clickable" data-detail="${m.id}">
      <div class="lb-card-head"><span class="lb-tag lb-live">🔴 EN JUEGO</span><span class="lb-when lb-when-live">${min}</span></div>
      <div class="lb-match">
        <span class="lb-tm lb-tm-h"><span class="name">${m.home_team}</span>${crest(m.home_team)}</span>
        ${_boxes(m.home_score ?? 0, m.away_score ?? 0, "lb-boxes-live")}
        <span class="lb-tm lb-tm-a">${crest(m.away_team)}<span class="name">${m.away_team}</span></span>
      </div>
      <div class="lb-foot">${p ? `Tu pronóstico: <b>${p.pred_home}–${p.pred_away}</b> · <span class="lb-cmp">${cmp}</span>` : "📝 No pronosticaste este partido"}<span class="lb-ver"> · ver detalle ▸</span></div>
    </div>`;
}

function liveBoxHtml() {
  const ahora = Date.now();
  const lives = state.matches.filter(enCurso).sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff));
  const next = state.matches
    .filter((m) => m.kickoff && new Date(m.kickoff).getTime() > ahora && !enCurso(m) && m.status !== "finished")
    .sort((a, b) => new Date(a.kickoff) - new Date(b.kickoff))[0];
  if (!lives.length && !next) return "";

  let cards = lives.map(liveCard).join("");
  if (next) {
    const p = state.myPreds[next.id];
    cards += `<div class="lb-card">
      <div class="lb-card-head"><span class="lb-tag lb-next">⏭️ PRÓXIMO</span><span class="lb-when">${fmtDate(next.kickoff)}</span></div>
      <div class="lb-match">
        <span class="lb-tm lb-tm-h"><span class="name">${next.home_team}</span>${crest(next.home_team)}</span>
        ${p ? _boxes(p.pred_home, p.pred_away, "lb-boxes-pred") : `<span class="lb-vs">vs</span>`}
        <span class="lb-tm lb-tm-a">${crest(next.away_team)}<span class="name">${next.away_team}</span></span>
      </div>
      <div class="lb-foot ${p ? "" : "lb-foot-warn"}">${p ? "👆 Tu pronóstico" : "📝 Aún no has pronosticado este partido"}</div>
    </div>`;
  }
  const live = lives.length;
  const titulo = live ? "🔴 EN VIVO" : "📡 Próximos partidos";
  return `<div class="livebox ${live ? "livebox-live" : ""}">
    <div class="lb-title">${titulo}</div>${cards}</div>`;
}

// Barra de guardado fija (se queda arriba al hacer scroll)
function saveBar(btnId, hintId) {
  return `<div class="save-bar">
    <button class="primary" id="${btnId}">💾 Guardar pronósticos</button>
    <span class="save-hint" id="${hintId}"></span>
  </div>`;
}
function wireSave(cont, btnId, hintId) {
  dirty = false;
  cont.querySelectorAll(".score-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      dirty = true;
      const h = el(hintId); if (h) h.textContent = "Cambios sin guardar…";
    });
  });
  const btn = el(btnId);
  if (btn) btn.onclick = () => saveAllPredictions(cont, btn, hintId);
}

// Auto-refresco "en vivo": refresca marcadores y ranking cada 30s,
// sin borrar lo que el usuario esté escribiendo (bandera dirty).
let dirty = false;
let liveTimer = null;
function startLiveRefresh() {
  if (liveTimer) return;
  liveTimer = setInterval(async () => {
    if (!state.user) return;
    const active = document.querySelector("#nav button.active")?.dataset.view;
    const { data: ms } = await sb.from("matches").select("*")
      .order("kickoff", { ascending: true }).order("id");
    if (ms) state.matches = ms;
    if (active === "ranking") loadRanking();
    else if (!dirty) {
      if (active === "today") renderToday();
      else if (active === "weekend") renderWeekend();
      else if (active === "matches") renderMatches();
    }
  }, 30000);
}

// =====================================================================
//  Vista: HOY (partidos del día)
// =====================================================================
function renderToday() {
  const cont = el("todayContainer");
  if (!state.matches.length) {
    cont.innerHTML = '<div class="loading">Aún no hay partidos cargados.</div>';
    return;
  }

  const hoy = todayYMD();
  const partidosHoy = state.matches.filter((m) => m.kickoff && bogotaYMD(m.kickoff) === hoy);
  const fechaLinda = new Date().toLocaleDateString("es-CO", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota",
  });

  // Resumen del día: cuántos hay, cuántos pronosticaste, cuántos cerrados
  const pronost = partidosHoy.filter((m) => state.myPreds[m.id]).length;
  const cerrados = partidosHoy.filter((m) => isLocked(m)).length;

  let lista = partidosHoy;
  let encabezado;
  if (partidosHoy.length) {
    encabezado = `
      <div class="today-head">
        <div class="today-title">📅 Partidos de hoy</div>
        <div class="today-date">${fechaLinda}</div>
        <div class="today-stats">
          <span>⚽ <b>${partidosHoy.length}</b> partidos</span>
          <span>📝 <b>${pronost}</b> pronosticados</span>
          <span>🔒 <b>${cerrados}</b> cerrados</span>
        </div>
      </div>`;
  } else {
    // No hay hoy: muestro los próximos
    lista = state.matches
      .filter((m) => m.kickoff && new Date(m.kickoff) > new Date())
      .slice(0, 6);
    encabezado = `
      <div class="today-head">
        <div class="today-title">📅 Hoy no hay partidos del Mundial</div>
        <div class="today-date">${fechaLinda}</div>
        <div class="today-stats"><span>Aquí van los <b>próximos</b> partidos 👇</span></div>
      </div>`;
  }

  let html = lista.length ? saveBar("saveTodayBtn", "saveHintToday") : "";
  html += encabezado;
  for (const m of lista) html += matchRow(m);
  cont.innerHTML = html;
  wireSave(cont, "saveTodayBtn", "saveHintToday");
}

// =====================================================================
//  Vista: FIN DE SEMANA (sábado y domingo)
// =====================================================================
function renderWeekend() {
  const cont = el("weekendContainer");
  if (!state.matches.length) {
    cont.innerHTML = '<div class="loading">Aún no hay partidos cargados.</div>';
    return;
  }

  // Fechas (YYYY-MM-DD, hora Colombia) del sábado y domingo de este fin de semana
  const bog = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
  const dow = bog.getDay(); // 0=Dom .. 6=Sáb
  const satOffset = dow === 0 ? -1 : 6 - dow;
  const sat = new Date(bog); sat.setDate(bog.getDate() + satOffset);
  const sun = new Date(sat); sun.setDate(sat.getDate() + 1);
  const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  const finde = new Set([ymd(sat), ymd(sun)]);

  const lista = state.matches.filter((m) => m.kickoff && finde.has(bogotaYMD(m.kickoff)));
  const rango = `${sat.toLocaleDateString("es-CO", { day: "numeric", month: "long" })} y ${sun.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}`;

  const pronost = lista.filter((m) => state.myPreds[m.id]).length;
  const cerrados = lista.filter((m) => isLocked(m)).length;

  if (!lista.length) {
    cont.innerHTML = `<div class="today-head">
      <div class="today-title">🗓️ Fin de semana</div>
      <div class="today-date">${rango}</div>
      <div class="today-stats"><span>No hay partidos del Mundial este fin de semana.</span></div>
    </div>`;
    return;
  }

  let html = saveBar("saveWeekBtn", "saveHintWeek");
  html += `<div class="today-head">
    <div class="today-title">🗓️ Partidos del fin de semana</div>
    <div class="today-date">${rango}</div>
    <div class="today-stats">
      <span>⚽ <b>${lista.length}</b> partidos</span>
      <span>📝 <b>${pronost}</b> pronosticados</span>
      <span>🔒 <b>${cerrados}</b> cerrados</span>
    </div>
  </div>`;
  // Agrupar por día
  const porDia = {};
  for (const m of lista) (porDia[bogotaYMD(m.kickoff)] ||= []).push(m);
  for (const dia of Object.keys(porDia).sort()) {
    const etiqueta = new Date(dia + "T12:00:00").toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
    html += `<div class="group"><div class="group-title">${etiqueta}</div>`;
    for (const m of porDia[dia]) html += matchRow(m);
    html += `</div>`;
  }
  cont.innerHTML = html;
  wireSave(cont, "saveWeekBtn", "saveHintWeek");
}

function matchRow(m) {
  const pred = state.myPreds[m.id];
  const locked = isLocked(m);
  const hasResult = m.home_score != null && m.away_score != null;
  const pts = pointsFor(pred, m);

  const ph = pred ? pred.pred_home : "";
  const pa = pred ? pred.pred_away : "";

  let right = `<span class="badge"></span>`;
  if (m.status === "live")
    right = `<span class="badge live">🔴 ${m.home_score ?? 0}–${m.away_score ?? 0} · ${liveMinute(m)}</span>`;
  else if (m.status === "halftime")
    right = `<span class="badge live">⏸️ ENTRETIEMPO ${m.home_score ?? 0}–${m.away_score ?? 0}</span>`;
  else if (hasResult) right = `<span class="badge result">Final ${m.home_score}–${m.away_score}</span>`;
  else if (locked) right = `<span class="badge locked">🔒 Cerrado</span>`;

  let ptsBadge = "";
  if (pts != null) ptsBadge = `<span class="badge pts">+${pts} pts</span>`;

  return `
  <div class="match">
    <div class="team home"><span class="name">${m.home_team}</span><span class="flag">${crest(m.home_team)}</span></div>
    <div class="scores">
      <input class="score-input" type="number" min="0" max="99" inputmode="numeric"
             data-mid="${m.id}" data-side="home" value="${ph}" ${locked ? "disabled" : ""} />
      <span class="vs">-</span>
      <input class="score-input" type="number" min="0" max="99" inputmode="numeric"
             data-mid="${m.id}" data-side="away" value="${pa}" ${locked ? "disabled" : ""} />
    </div>
    <div class="team away"><span class="flag">${crest(m.away_team)}</span><span class="name">${m.away_team}</span></div>
    <div class="meta">
      <span>🕒 ${fmtDate(m.kickoff)}${(m.live_events && m.live_events.length) ? ` · <a class="detalle-link" data-detail="${m.id}">⚽ detalle</a>` : ""}</span>
      <span>${ptsBadge} ${right}</span>
    </div>
  </div>`;
}

async function saveAllPredictions(container, btn, hintId) {
  container = container || el("matchesContainer");
  btn = btn || el("saveAllBtn");
  // Recolectar los dos marcadores de cada partido (solo dentro de este contenedor)
  const byMatch = {};
  container.querySelectorAll(".score-input").forEach((inp) => {
    const mid = Number(inp.dataset.mid);
    (byMatch[mid] ||= {})[inp.dataset.side] = inp.value === "" ? null : Number(inp.value);
  });

  // Solo partidos con AMBOS marcadores y que NO estén cerrados (revalida la hora ahora)
  const payload = [];
  let omitidosCerrados = 0;
  for (const midStr of Object.keys(byMatch)) {
    const mid = Number(midStr);
    const r = byMatch[mid];
    if (r.home == null || r.away == null) continue; // incompleto: no lo mando
    const m = state.matches.find((x) => x.id === mid);
    if (m && isLocked(m)) { omitidosCerrados++; continue; } // ya cerró: lo omito
    payload.push({
      user_id: state.user.id, match_id: mid,
      pred_home: r.home, pred_away: r.away, updated_at: new Date().toISOString(),
    });
  }

  if (!payload.length) {
    return toast(omitidosCerrados ? "Esos partidos ya están cerrados" : "Escribe al menos un marcador completo", "error");
  }

  const savingText = btn.textContent;
  btn.disabled = true; btn.textContent = "Guardando...";

  // Intento en lote; si falla, guardo uno por uno para no perder los válidos
  let okCount = 0, failMsg = "";
  const { error } = await sb.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
  if (!error) {
    okCount = payload.length;
    payload.forEach((p) => (state.myPreds[p.match_id] = p));
  } else {
    console.error("Lote falló, guardando uno por uno:", error);
    for (const row of payload) {
      const res = await sb.from("predictions").upsert(row, { onConflict: "user_id,match_id" });
      if (res.error) { failMsg = res.error.message; console.error("Fallo partido", row.match_id, res.error); }
      else { okCount++; state.myPreds[row.match_id] = row; }
    }
  }

  btn.disabled = false; btn.textContent = savingText;
  if (hintId && el(hintId)) el(hintId).textContent = "";
  if (okCount > 0) dirty = false;

  if (okCount === 0) {
    toast("No se pudo guardar: " + (failMsg || "permiso denegado"), "error");
  } else {
    let msg = `Guardado ✅ (${okCount})`;
    if (omitidosCerrados) msg += ` · ${omitidosCerrados} ya cerrados`;
    if (okCount < payload.length) msg += ` · ${payload.length - okCount} fallaron`;
    toast(msg);
  }
}

// =====================================================================
//  Vista: Ranking
// =====================================================================
async function loadRanking() {
  const cont = el("rankingContainer");
  cont.innerHTML = '<div class="loading">Cargando ranking…</div>';
  const { data, error } = await sb.rpc("get_leaderboard");
  if (error) { cont.innerHTML = `<div class="loading">Error: ${error.message}</div>`; return; }
  if (!data?.length) { cont.innerHTML = '<div class="loading">Aún no hay jugadores.</div>'; return; }

  let html = `<div class="rank-wrap"><table class="rank"><thead><tr>
    <th class="num">#</th><th>Jugador</th>
    <th class="num">Pts</th><th class="num">✅</th><th class="num col-opt">🎯</th><th class="num col-opt">Jug.</th>
    </tr></thead><tbody>`;
  data.forEach((row, i) => {
    const me = row.user_id === state.user.id;
    const posClass = i < 3 ? `pos p${i + 1}` : "pos";
    const medal = i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : "";
    html += `<tr class="${me ? "me" : ""}">
      <td class="num"><span class="${posClass}">${i + 1}</span></td>
      <td><span class="player">${avatarHtml(row.avatar_url, row.display_name)}<span>${medal}${row.display_name}${me ? " (tú)" : ""}</span></span></td>
      <td class="num"><span class="pts-big">${row.points}</span></td>
      <td class="num">${row.hits}</td>
      <td class="num col-opt">${row.exacts}</td>
      <td class="num col-opt">${row.played}</td>
    </tr>`;
  });
  html += `</tbody></table></div>
    <p class="muted rank-legend">✅ aciertos · 🎯 marcadores exactos · Jug. = partidos jugados</p>`;
  cont.innerHTML = html;
}

// =====================================================================
//  Vista: Admin (cargar resultados reales)
// =====================================================================
function renderAdmin() {
  if (!state.profile?.is_admin) return;
  const cont = el("adminContainer");

  const byStage = {};
  for (const m of state.matches) {
    const key = m.stage === "group" ? "group:" + m.group_letter : m.stage;
    (byStage[key] ||= []).push(m);
  }

  let html = "";
  for (const key of Object.keys(byStage)) {
    const [stage, letter] = key.split(":");
    const title = stage === "group" ? `Grupo ${letter}` : STAGE_LABELS[stage] || stage;
    html += `<div class="group"><div class="group-title">${title}</div>`;
    for (const m of byStage[key]) {
      html += `
      <div class="match">
        <div class="team home"><span class="name">${m.home_team}</span><span class="flag">${crest(m.home_team)}</span></div>
        <div class="scores">
          <input class="score-input" type="number" min="0" max="99" data-mid="${m.id}" data-side="home"
                 value="${m.home_score ?? ""}" />
          <span class="vs">-</span>
          <input class="score-input" type="number" min="0" max="99" data-mid="${m.id}" data-side="away"
                 value="${m.away_score ?? ""}" />
        </div>
        <div class="team away"><span class="flag">${crest(m.away_team)}</span><span class="name">${m.away_team}</span></div>
        <div class="meta"><span>🕒 ${fmtDate(m.kickoff)}</span>
          <button class="ghost" data-save="${m.id}">Guardar resultado</button></div>
      </div>`;
    }
    html += `</div>`;
  }
  cont.innerHTML = html;

  cont.querySelectorAll("[data-save]").forEach((btn) => {
    btn.onclick = () => saveResult(Number(btn.dataset.save));
  });

  loadParticipation();
}

// Botón flotante: dispara el robot de resultados (football-data)
el("syncFab").onclick = triggerSync;
async function triggerSync() {
  const btn = el("syncFab");
  const { error } = await sb.rpc("trigger_sync");
  if (error) { toast("No se pudo sincronizar: " + error.message, "error"); return; }

  const orig = btn.textContent;
  btn.disabled = true;
  toast("Sincronizando… los resultados aparecen en ~30s ⏳");
  let secs = 30;
  btn.textContent = `⏳ ${secs}s`;
  const timer = setInterval(() => {
    secs -= 1;
    btn.textContent = `⏳ ${secs}s`;
    if (secs <= 0) clearInterval(timer);
  }, 1000);

  setTimeout(async () => {
    clearInterval(timer);
    await loadMatchesAndPreds();
    if (!el("adminView").classList.contains("hidden")) renderAdmin();
    btn.disabled = false;
    btn.textContent = orig;
    toast("Listo ✅ resultados actualizados");
  }, 30000);
}

// ----- Participación (solo admin) -----
async function loadParticipation() {
  const cont = el("participationContainer");
  const total = state.matches.length;
  const { data, error } = await sb.rpc("admin_participation");
  if (error) { cont.innerHTML = `<div class="loading">Error: ${error.message}</div>`; return; }
  if (!data?.length) { cont.innerHTML = '<div class="loading">Aún no hay jugadores.</div>'; return; }

  let html = `<div class="rank-wrap"><table class="rank"><thead><tr>
    <th>Jugador</th><th class="num">Pronósticos</th><th>Último cambio</th><th class="num"></th>
    </tr></thead><tbody>`;
  data.forEach((row) => {
    const n = Number(row.total);
    const done = n >= total && total > 0;
    html += `<tr>
      <td><span class="player">${avatarHtml(row.avatar_url, row.display_name)}<span>${row.display_name}</span></span></td>
      <td class="num"><b class="${done ? "all-done" : ""}">${n}</b><span class="muted">/${total}</span></td>
      <td class="muted">${row.last_update ? fmtDate(row.last_update) : "—"}</td>
      <td class="num">${n > 0 ? `<button class="ghost" data-view="${row.user_id}" data-name="${encodeURIComponent(row.display_name)}">Ver</button>` : ""}</td>
    </tr>`;
  });
  html += `</tbody></table></div>`;
  cont.innerHTML = html;

  cont.querySelectorAll("[data-view]").forEach((btn) => {
    btn.onclick = () => viewUserPredictions(btn.dataset.view, decodeURIComponent(btn.dataset.name));
  });
}

let modalUser = null;
async function viewUserPredictions(uid, name) {
  modalUser = uid;
  el("modalTitle").textContent = "Pronósticos de " + name;
  el("modalBody").innerHTML = '<div class="loading">Cargando…</div>';
  el("modal").classList.remove("hidden");

  const { data, error } = await sb.rpc("admin_user_predictions", { p_user: uid });
  if (error) { el("modalBody").innerHTML = `<div class="loading">Error: ${error.message}</div>`; return; }
  if (!data?.length) { el("modalBody").innerHTML = '<div class="loading">No hay partidos.</div>'; return; }

  let html = `<p class="muted modal-note">Llena o corrige los pronósticos de este jugador (puedes hacerlo aunque el partido ya esté cerrado). Deja vacío para no cambiar.</p>`;
  for (const r of data) {
    const played = r.home_score != null && r.away_score != null;
    const pred = r.pred_home != null ? { pred_home: r.pred_home, pred_away: r.pred_away } : null;
    const pts = played && pred ? pointsFor(pred, { home_score: r.home_score, away_score: r.away_score }) : null;
    const realTxt = played ? `<span class="badge result">real ${r.home_score}–${r.away_score}</span>` : "";
    const ptsTxt = pts != null ? `<span class="badge pts">+${pts}</span>` : "";
    html += `<div class="pred-edit">
      <span class="pe-home"><span class="name">${r.home_team}</span>${crest(r.home_team)}</span>
      <input class="score-input pe-in" type="number" min="0" max="99" data-mid="${r.match_id}" data-side="home" value="${r.pred_home ?? ""}" />
      <span class="vs">-</span>
      <input class="score-input pe-in" type="number" min="0" max="99" data-mid="${r.match_id}" data-side="away" value="${r.pred_away ?? ""}" />
      <span class="pe-away">${crest(r.away_team)}<span class="name">${r.away_team}</span></span>
      <span class="pe-meta">${realTxt}${ptsTxt}</span>
    </div>`;
  }
  html += `<div class="modal-foot"><button class="primary" id="saveUserPredsBtn">Guardar pronósticos de ${name}</button></div>`;
  el("modalBody").innerHTML = html;
  el("saveUserPredsBtn").onclick = saveUserPredictions;
}

async function saveUserPredictions() {
  const byMatch = {};
  el("modalBody").querySelectorAll(".pe-in").forEach((inp) => {
    const mid = Number(inp.dataset.mid);
    (byMatch[mid] ||= {})[inp.dataset.side] = inp.value === "" ? null : Number(inp.value);
  });
  // Solo enviar los que tengan AMBOS marcadores (para llenar/corregir)
  const rows = Object.keys(byMatch)
    .map((mid) => ({ match_id: Number(mid), home: byMatch[mid].home, away: byMatch[mid].away }))
    .filter((r) => r.home != null && r.away != null);

  if (!rows.length) return toast("Escribe al menos un marcador completo", "error");

  const btn = el("saveUserPredsBtn");
  btn.disabled = true; btn.textContent = "Guardando...";
  const { error } = await sb.rpc("admin_set_predictions", { p_user: modalUser, p_data: rows });
  btn.disabled = false; btn.textContent = "Guardar pronósticos";

  if (error) { toast("Error: " + error.message, "error"); return; }
  toast(`Guardado ✅ (${rows.length} pronósticos)`);
  loadParticipation();
}

el("modalClose").onclick = () => el("modal").classList.add("hidden");
el("modal").onclick = (e) => { if (e.target.id === "modal") el("modal").classList.add("hidden"); };

// Detalle de un partido: marcador, estado/minuto y línea de eventos (goles/cambios/tarjetas)
function openMatchDetail(id) {
  const m = state.matches.find((x) => x.id === id);
  if (!m) return;
  el("modalTitle").textContent = `${m.home_team} vs ${m.away_team}`;
  const score = m.home_score != null ? `${m.home_score} – ${m.away_score}` : "vs";
  const estado = m.status === "live" ? `🔴 EN VIVO ${liveMinute(m)}`
    : m.status === "halftime" ? "⏸️ Entretiempo"
    : m.home_score != null ? "Final" : `🕒 ${fmtDate(m.kickoff)}`;

  let body = `<div class="md-score">
      <span>${crest(m.home_team)} ${m.home_team}</span>
      <span class="md-sc">${score}</span>
      <span>${m.away_team} ${crest(m.away_team)}</span>
    </div>
    <div class="md-state ${m.status === "live" ? "live" : ""}">${estado}</div>`;

  const evs = (m.live_events || []).slice().sort((a, b) => (a.min || 0) - (b.min || 0));
  if (evs.length) {
    body += `<div class="md-timeline">` + evs.map((e) => {
      const icon = e.type === "Goal" ? "⚽" : e.type === "subst" ? "🔄"
        : /red/i.test(e.detail) ? "🟥" : "🟨";
      let txt;
      if (e.type === "Goal") txt = `<b>${e.player}</b>${e.assist ? ` <span class="muted">(asist. ${e.assist})</span>` : ""}`;
      else if (e.type === "subst") txt = `Entra <b>${e.player}</b>${e.assist ? ` · Sale ${e.assist}` : ""}`;
      else txt = `${e.detail || "Tarjeta"} — ${e.player}`;
      const min = (e.min ?? "") + (e.extra ? "+" + e.extra : "") + "'";
      return `<div class="md-ev"><span class="md-min">${min}</span><span>${icon}</span>
        <span class="md-txt">${txt} <span class="muted">· ${e.team}</span></span></div>`;
    }).join("") + `</div>`;
  } else {
    body += `<p class="muted md-empty">Sin detalle de goles/cambios disponible.<br>
      <span style="font-size:.8rem">(Aparece durante el partido y queda guardado al terminar.)</span></p>`;
  }
  el("modalBody").innerHTML = body;
  el("modal").classList.remove("hidden");
}

// Clic en cualquier "[data-detail]" abre el detalle del partido
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-detail]");
  if (t) { e.preventDefault(); openMatchDetail(Number(t.dataset.detail)); }
});

async function saveResult(mid) {
  const home = document.querySelector(`#adminContainer .score-input[data-mid="${mid}"][data-side="home"]`).value;
  const away = document.querySelector(`#adminContainer .score-input[data-mid="${mid}"][data-side="away"]`).value;
  const payload = {
    home_score: home === "" ? null : Number(home),
    away_score: away === "" ? null : Number(away),
  };
  const { error } = await sb.from("matches").update(payload).eq("id", mid);
  if (error) { toast("Error: " + error.message, "error"); return; }
  const m = state.matches.find((x) => x.id === mid);
  if (m) Object.assign(m, payload);
  toast("Resultado guardado ✅");
}
