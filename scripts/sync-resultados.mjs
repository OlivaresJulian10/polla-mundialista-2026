// =====================================================================
//  Sincroniza resultados y horarios del Mundial 2026 hacia Supabase.
//  Fuente PRINCIPAL: football-data.org (rápida y confiable, 1 sola llamada).
//  Respaldo: TheSportsDB (por día) si no hay token de football-data.
//  Solo escribe marcadores FINALES. También corrige los horarios.
//  Requiere el secret SUPABASE_SERVICE_KEY (y, recomendado, FOOTBALL_DATA_TOKEN).
// =====================================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ucaalcrdujucpdnmxjsd.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FD_TOKEN = process.env.FOOTBALL_DATA_TOKEN;     // football-data.org
const AF_KEY = process.env.API_FOOTBALL_KEY;          // api-football (minuto exacto)
const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "3"; // respaldo
const LEAGUE = "4429";

if (!SERVICE_KEY) {
  console.error("❌ Falta el secret SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

// Nombre en inglés (cualquiera de las dos fuentes) -> nombre en español (app)
const EN2ES = {
  "mexico": "México", "south africa": "Sudáfrica", "south korea": "Corea del Sur",
  "czech republic": "Chequia", "czechia": "Chequia", "canada": "Canadá",
  "bosnia and herzegovina": "Bosnia y Herzegovina", "bosnia-herzegovina": "Bosnia y Herzegovina",
  "qatar": "Catar", "switzerland": "Suiza", "usa": "Estados Unidos",
  "united states": "Estados Unidos", "paraguay": "Paraguay", "australia": "Australia",
  "turkey": "Turquía", "türkiye": "Turquía", "turkiye": "Turquía", "brazil": "Brasil",
  "morocco": "Marruecos", "haiti": "Haití", "scotland": "Escocia", "germany": "Alemania",
  "curacao": "Curazao", "curaçao": "Curazao", "netherlands": "Países Bajos", "japan": "Japón",
  "ivory coast": "Costa de Marfil", "cote d'ivoire": "Costa de Marfil", "côte d'ivoire": "Costa de Marfil",
  "ecuador": "Ecuador", "sweden": "Suecia", "tunisia": "Túnez", "spain": "España",
  "cape verde": "Cabo Verde", "cape verde islands": "Cabo Verde", "belgium": "Bélgica",
  "egypt": "Egipto", "saudi arabia": "Arabia Saudita", "uruguay": "Uruguay", "iran": "Irán",
  "new zealand": "Nueva Zelanda", "france": "Francia", "senegal": "Senegal", "iraq": "Irak",
  "norway": "Noruega", "argentina": "Argentina", "algeria": "Argelia", "austria": "Austria",
  "jordan": "Jordania", "portugal": "Portugal", "dr congo": "RD Congo", "congo dr": "RD Congo",
  "democratic republic of congo": "RD Congo", "england": "Inglaterra", "croatia": "Croacia",
  "ghana": "Ghana", "panama": "Panamá", "uzbekistan": "Uzbekistán", "colombia": "Colombia",
};
const norm = (s) => (s || "").trim().toLowerCase();
const toES = (n) => EN2ES[norm(n)] || n;
const pairKey = (a, b) => [norm(a), norm(b)].sort().join(" :: ");

const headers = {
  apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
};

// ---------- Fuente principal: football-data.org ----------
async function getFromFootballData() {
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": FD_TOKEN },
  });
  if (!res.ok) throw new Error(`football-data ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const LIVE = new Set(["IN_PLAY", "LIVE", "SUSPENDED"]);
  return (data.matches || []).map((m) => ({
    home: toES(m.homeTeam?.name), away: toES(m.awayTeam?.name),
    st: m.status === "FINISHED" ? "finished"
      : m.status === "PAUSED" ? "halftime"
      : LIVE.has(m.status) ? "live" : "scheduled",
    hs: m.score?.fullTime?.home, as: m.score?.fullTime?.away,
    kickoff: m.utcDate || null,
  }));
}

// ---------- Respaldo: TheSportsDB por día ----------
async function getFromSportsDB() {
  const dates = [];
  for (let i = 3; i >= -13; i--) dates.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const seen = new Set(), out = [];
  for (const d of dates) {
    try {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventsday.php?d=${d}&s=Soccer`);
      if (!r.ok) continue;
      for (const ev of ((await r.json()).events || [])) {
        if (ev.idLeague !== LEAGUE || seen.has(ev.idEvent)) continue;
        seen.add(ev.idEvent);
        const raw = (ev.strStatus || "").toLowerCase();
        const finished = raw === "ft" || raw.includes("finished") || raw.includes("aet") || raw.includes("pen");
        const half = !finished && (raw === "ht" || raw.includes("half"));
        const live = !finished && !half && (/^\d/.test(raw) || raw.includes("1h") || raw.includes("2h") || raw.includes("live"));
        out.push({
          home: toES(ev.strHomeTeam), away: toES(ev.strAwayTeam),
          st: finished ? "finished" : half ? "halftime" : live ? "live" : "scheduled",
          hs: ev.intHomeScore == null ? null : +ev.intHomeScore,
          as: ev.intAwayScore == null ? null : +ev.intAwayScore,
          kickoff: ev.strTimestamp ? (ev.strTimestamp.endsWith("Z") ? ev.strTimestamp : ev.strTimestamp + "Z") : null,
        });
      }
    } catch {}
  }
  return out;
}

// Minuto EXACTO + eventos (goles, cambios, tarjetas) del Mundial en vivo.
// Una sola llamada (fixtures?live=all, incluye 'events') → no gasta cupo extra.
// Solo se usa cuando hay partidos en vivo (cuida el cupo gratis 100/día).
async function getLiveData() {
  if (!AF_KEY) return new Map();
  try {
    const r = await fetch("https://v3.football.api-sports.io/fixtures?live=all",
      { headers: { "x-apisports-key": AF_KEY } });
    if (!r.ok) { console.warn("API-Football", r.status); return new Map(); }
    const j = await r.json();
    const map = new Map();
    for (const f of (j.response || [])) {
      if (!/world cup/i.test(f.league?.name || "")) continue;
      const events = (f.events || [])
        .filter((e) => ["Goal", "subst", "Card"].includes(e.type))
        .map((e) => ({
          min: e.time?.elapsed ?? null, extra: e.time?.extra ?? null,
          type: e.type, detail: e.detail || "",
          team: e.team?.name || "", player: e.player?.name || "", assist: e.assist?.name || "",
        }));
      map.set(pairKey(toES(f.teams?.home?.name), toES(f.teams?.away?.name)),
        { minute: f.fixture?.status?.elapsed ?? null, events });
    }
    return map;
  } catch (e) { console.warn("API-Football falló:", e.message); return new Map(); }
}

async function main() {
  let events, fuente;
  if (FD_TOKEN) {
    try { events = await getFromFootballData(); fuente = "football-data.org"; }
    catch (e) { console.warn("⚠️ football-data falló, uso respaldo:", e.message); }
  }
  if (!events) { events = await getFromSportsDB(); fuente = "TheSportsDB (respaldo)"; }
  console.log(`Fuente: ${fuente} | partidos: ${events.length}`);

  // Minuto exacto solo si hay algo en vivo (cuida el cupo de API-Football)
  const hayVivos = events.some((e) => e.st === "live");
  const liveData = hayVivos ? await getLiveData() : new Map();
  if (hayVivos) console.log(`En vivo (API-Football): ${liveData.size}`);

  // Tolerante: si aún no existen las columnas nuevas, reintenta sin ellas
  let mRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=id,home_team,away_team,home_score,away_score,kickoff,status,live_minute`, { headers });
  if (!mRes.ok) mRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?select=id,home_team,away_team,home_score,away_score,kickoff,status`, { headers });
  const matches = await mRes.json();
  const idx = new Map();
  for (const m of matches) idx.set(pairKey(m.home_team, m.away_team), m);

  let resultados = 0, vivos = 0, horas = 0, sinCambios = 0, sinJugar = 0, sinCoincidencia = 0;

  for (const ev of events) {
    const m = idx.get(pairKey(ev.home, ev.away));
    if (!m) { sinCoincidencia++; continue; }
    const patch = {};

    // Horario (cualquier estado)
    if (ev.kickoff) {
      const nueva = new Date(ev.kickoff);
      if (!isNaN(nueva) && (!m.kickoff || Math.abs(new Date(m.kickoff) - nueva) > 60000)) {
        patch.kickoff = nueva.toISOString();
      }
    }

    // Estado en juego (en vivo / entretiempo) / finalizado / programado
    const enJuego = ev.st === "live" || ev.st === "halftime";
    if (enJuego || ev.st === "finished") {
      if (ev.hs != null && ev.as != null) {
        const hs = +ev.hs, as = +ev.as;
        if (m.home_score !== hs) patch.home_score = hs;
        if (m.away_score !== as) patch.away_score = as;
      }
    }
    if (m.status !== ev.st && ev.st !== "scheduled") patch.status = ev.st;
    else if (ev.st === "scheduled" && (m.status === "live" || m.status === "halftime")) patch.status = "scheduled";

    // Minuto exacto + eventos (solo en vivo). Al finalizar se conservan los eventos.
    if (ev.st === "live") {
      const d = liveData.get(pairKey(ev.home, ev.away));
      if (d) {
        if (d.minute != null) { patch.live_minute = d.minute; patch.live_minute_at = new Date().toISOString(); }
        if (d.events) patch.live_events = d.events;
      }
    } else if (ev.st !== "finished" && m.live_minute != null) {
      patch.live_minute = null; patch.live_minute_at = null;
    } else if (ev.st === "finished" && m.live_minute != null) {
      patch.live_minute = null; patch.live_minute_at = null; // limpia minuto pero CONSERVA live_events
    }

    if (Object.keys(patch).length === 0) {
      if (enJuego) vivos++; else if (ev.st === "finished") sinCambios++; else sinJugar++;
      continue;
    }

    const r = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) { console.error(`❌ ${ev.home} vs ${ev.away}: ${r.status} ${await r.text()}`); continue; }
    if (patch.kickoff) horas++;
    if (enJuego) { console.log(`🔴 ${ev.st === "halftime" ? "ENTRETIEMPO" : "EN VIVO"} ${m.home_team} ${ev.hs}-${ev.as} ${m.away_team}`); vivos++; }
    else if (ev.st === "finished") { console.log(`✓ FINAL ${m.home_team} ${ev.hs}-${ev.as} ${m.away_team}`); resultados++; }
  }

  console.log(`\nResumen → finalizados: ${resultados} | en vivo: ${vivos} | horas: ${horas} | sin cambios: ${sinCambios} | por jugar: ${sinJugar} | sin coincidencia: ${sinCoincidencia}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
