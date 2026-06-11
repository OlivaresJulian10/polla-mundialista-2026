// =====================================================================
//  Polla Mundialista 2026 — Lógica de la aplicación
// =====================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

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
  return d.toLocaleString("es", {
    weekday: "short", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

const isLocked = (m) => m.kickoff && new Date(m.kickoff) <= new Date();

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

el("tabLogin").onclick = () => switchAuthTab("login");
el("tabSignup").onclick = () => switchAuthTab("signup");
function switchAuthTab(which) {
  const login = which === "login";
  el("tabLogin").classList.toggle("active", login);
  el("tabSignup").classList.toggle("active", !login);
  el("loginForm").classList.toggle("hidden", !login);
  el("signupForm").classList.toggle("hidden", login);
  showAuthMsg("");
}

el("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  showAuthMsg("Entrando...");
  const { error } = await sb.auth.signInWithPassword({
    email: el("loginEmail").value.trim(),
    password: el("loginPass").value,
  });
  if (error) return showAuthMsg(traducirError(error.message), "error");
  // onAuthStateChange se encarga del resto
};

el("signupForm").onsubmit = async (e) => {
  e.preventDefault();
  showAuthMsg("Creando cuenta...");
  const { data, error } = await sb.auth.signUp({
    email: el("signupEmail").value.trim(),
    password: el("signupPass").value,
    options: { data: { display_name: el("signupName").value.trim() } },
  });
  if (error) return showAuthMsg(traducirError(error.message), "error");
  if (data.session) return; // ya quedó logueado
  showAuthMsg("✅ Cuenta creada. Revisa tu correo si pide confirmación, luego inicia sesión.", "ok");
  switchAuthTab("login");
};

el("logoutBtn").onclick = async () => {
  await sb.auth.signOut();
  location.reload();
};

function traducirError(msg = "") {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "Correo o contraseña incorrectos.";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta.";
  if (m.includes("email not confirmed")) return "Debes confirmar tu correo antes de entrar.";
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
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

  await loadMatchesAndPreds();
  showView("matches");
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

  // Agrupar por etapa y, dentro de grupos, por letra
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
  else if (locked) right = `<span class="badge locked">🔒 En juego / jugado</span>`;

  let ptsBadge = "";
  if (pts != null) ptsBadge = `<span class="badge pts">+${pts} pts</span>`;

  return `
  <div class="match">
    <div class="team home"><span class="name">${m.home_team}</span></div>
    <div class="scores">
      <input class="score-input" type="number" min="0" max="99" inputmode="numeric"
             data-mid="${m.id}" data-side="home" value="${ph}" ${locked ? "disabled" : ""} />
      <span class="vs">-</span>
      <input class="score-input" type="number" min="0" max="99" inputmode="numeric"
             data-mid="${m.id}" data-side="away" value="${pa}" ${locked ? "disabled" : ""} />
    </div>
    <div class="team away"><span class="name">${m.away_team}</span></div>
    <div class="meta">
      <span>${fmtDate(m.kickoff)}</span>
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

  if (error) { toast("Error: " + error.message, "error"); return; }
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

  let html = `<table class="rank"><thead><tr>
    <th class="num">#</th><th>Jugador</th>
    <th class="num">Pts</th><th class="num">Exactos</th><th class="num">Aciertos</th><th class="num">Jugados</th>
    </tr></thead><tbody>`;
  data.forEach((row, i) => {
    const me = row.user_id === state.user.id;
    const posClass = i < 3 ? `pos p${i + 1}` : "pos";
    html += `<tr class="${me ? "me" : ""}">
      <td class="num"><span class="${posClass}">${i + 1}</span></td>
      <td>${row.display_name}${me ? " (tú)" : ""}</td>
      <td class="num"><span class="pts-big">${row.points}</span></td>
      <td class="num">${row.exacts}</td>
      <td class="num">${row.hits}</td>
      <td class="num">${row.played}</td>
    </tr>`;
  });
  html += `</tbody></table>`;
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
        <div class="team home"><span class="name">${m.home_team}</span></div>
        <div class="scores">
          <input class="score-input" type="number" min="0" max="99" data-mid="${m.id}" data-side="home"
                 value="${m.home_score ?? ""}" />
          <span class="vs">-</span>
          <input class="score-input" type="number" min="0" max="99" data-mid="${m.id}" data-side="away"
                 value="${m.away_score ?? ""}" />
        </div>
        <div class="team away"><span class="name">${m.away_team}</span></div>
        <div class="meta"><span>${fmtDate(m.kickoff)}</span>
          <button class="ghost" data-save="${m.id}">Guardar resultado</button></div>
      </div>`;
    }
    html += `</div>`;
  }
  cont.innerHTML = html;

  cont.querySelectorAll("[data-save]").forEach((btn) => {
    btn.onclick = () => saveResult(Number(btn.dataset.save));
  });
}

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
