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
const VIEWS = ["matches", "ranking", "admin"];
function showView(name) {
  VIEWS.forEach((v) => el(v + "View").classList.toggle("hidden", v !== name));
  document.querySelectorAll("#nav button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );
  if (name === "ranking") loadRanking();
  if (name === "admin") renderAdmin();
}
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

  // Agrupar por etapa y, dentro de grupos, por letra
  const byStage = {};
  for (const m of state.matches) {
    const key = m.stage === "group" ? "group:" + m.group_letter : m.stage;
    (byStage[key] ||= []).push(m);
  }

  let html = `
    <div class="summary">
      <div class="sum-main"><span class="sum-num">${total}</span><span class="sum-lbl">puntos</span></div>
      <div class="sum-stats">
        <span>🎯 <b>${exactos}</b> exactos</span>
        <span>✅ <b>${aciertos}</b> aciertos</span>
        <span>🏁 <b>${jugados}</b> jugados</span>
        <span>📝 <b>${pronosticados}</b> pronosticados</span>
      </div>
    </div>`;
  for (const key of Object.keys(byStage)) {
    const [stage, letter] = key.split(":");
    const title = stage === "group" ? `Grupo ${letter}` : STAGE_LABELS[stage] || stage;
    html += `<div class="group"><div class="group-title">${title}</div>`;
    for (const m of byStage[key]) html += matchRow(m);
    html += `</div>`;
  }
  html += `<div class="save-row"><button class="primary" id="saveAllBtn">Guardar pronósticos</button>
           <span class="muted" id="saveHint"></span></div>`;
  cont.innerHTML = html;

  cont.querySelectorAll(".score-input").forEach((inp) => {
    inp.addEventListener("input", () => {
      el("saveHint").textContent = "Tienes cambios sin guardar…";
    });
  });
  el("saveAllBtn").onclick = saveAllPredictions;
}

function matchRow(m) {
  const pred = state.myPreds[m.id];
  const locked = isLocked(m);
  const hasResult = m.home_score != null && m.away_score != null;
  const pts = pointsFor(pred, m);

  const ph = pred ? pred.pred_home : "";
  const pa = pred ? pred.pred_away : "";

  let right = `<span class="badge"></span>`;
  if (hasResult) right = `<span class="badge result">Final ${m.home_score}–${m.away_score}</span>`;
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
      <span>🕒 ${fmtDate(m.kickoff)}</span>
      <span>${ptsBadge} ${right}</span>
    </div>
  </div>`;
}

async function saveAllPredictions() {
  const rows = [];
  document.querySelectorAll(".score-input:not(:disabled)").forEach((inp) => {
    const mid = Number(inp.dataset.mid);
    const side = inp.dataset.side;
    const val = inp.value === "" ? null : Number(inp.value);
    let r = rows.find((x) => x.match_id === mid);
    if (!r) { r = { match_id: mid, home: null, away: null }; rows.push(r); }
    r[side] = val;
  });

  // Solo enviar partidos con AMBOS marcadores llenos
  const payload = rows
    .filter((r) => r.home != null && r.away != null)
    .map((r) => ({
      user_id: state.user.id,
      match_id: r.match_id,
      pred_home: r.home,
      pred_away: r.away,
      updated_at: new Date().toISOString(),
    }));

  if (!payload.length) return toast("Escribe al menos un marcador completo", "error");

  const btn = el("saveAllBtn");
  btn.disabled = true; btn.textContent = "Guardando...";
  const { error } = await sb.from("predictions").upsert(payload, { onConflict: "user_id,match_id" });
  btn.disabled = false; btn.textContent = "Guardar pronósticos";

  if (error) {
    console.error("Error guardando pronósticos:", error);
    toast("No se pudo guardar: " + (error.message || error.hint || "permiso denegado"), "error");
    return;
  }
  payload.forEach((p) => (state.myPreds[p.match_id] = p));
  el("saveHint").textContent = "";
  toast(`Guardado ✅ (${payload.length} pronósticos)`);
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

async function viewUserPredictions(uid, name) {
  el("modalTitle").textContent = "Pronósticos de " + name;
  el("modalBody").innerHTML = '<div class="loading">Cargando…</div>';
  el("modal").classList.remove("hidden");

  const { data, error } = await sb.rpc("admin_user_predictions", { p_user: uid });
  if (error) { el("modalBody").innerHTML = `<div class="loading">Error: ${error.message}</div>`; return; }
  if (!data?.length) { el("modalBody").innerHTML = '<div class="loading">Sin pronósticos.</div>'; return; }

  let html = "";
  for (const r of data) {
    const played = r.home_score != null && r.away_score != null;
    const pred = { pred_home: r.pred_home, pred_away: r.pred_away };
    const pts = played ? pointsFor(pred, { home_score: r.home_score, away_score: r.away_score }) : null;
    const ptsTxt = pts != null ? `<span class="badge pts">+${pts}</span>` : "";
    const realTxt = played ? `<span class="muted"> · real ${r.home_score}–${r.away_score}</span>` : "";
    html += `<div class="pred-row">
      <span class="pred-teams">${crest(r.home_team)} ${r.home_team} <b>${r.pred_home}–${r.pred_away}</b> ${r.away_team} ${crest(r.away_team)}</span>
      <span>${ptsTxt}${realTxt}</span>
    </div>`;
  }
  el("modalBody").innerHTML = html;
}

el("modalClose").onclick = () => el("modal").classList.add("hidden");
el("modal").onclick = (e) => { if (e.target.id === "modal") el("modal").classList.add("hidden"); };

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
