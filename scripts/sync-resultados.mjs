// =====================================================================
//  Sincroniza los resultados REALES del Mundial 2026 hacia Supabase.
//  Fuente: TheSportsDB (gratis). Liga 4429 (FIFA World Cup), temporada 2026.
//  Se ejecuta solo desde GitHub Actions cada 30 min.
//  Requiere el secret SUPABASE_SERVICE_KEY (clave 'secret' de Supabase).
// =====================================================================

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://ucaalcrdujucpdnmxjsd.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SPORTSDB_KEY = process.env.SPORTSDB_KEY || "3"; // clave pública de prueba
const LEAGUE = "4429";
const SEASON = "2026";

if (!SERVICE_KEY) {
  console.error("❌ Falta el secret SUPABASE_SERVICE_KEY en GitHub.");
  process.exit(1);
}

// Nombre en inglés (TheSportsDB) -> nombre en español (como está en la app)
const EN2ES = {
  "mexico": "México", "south africa": "Sudáfrica", "south korea": "Corea del Sur",
  "czech republic": "Chequia", "czechia": "Chequia", "canada": "Canadá",
  "bosnia and herzegovina": "Bosnia y Herzegovina", "qatar": "Catar",
  "switzerland": "Suiza", "usa": "Estados Unidos", "united states": "Estados Unidos",
  "paraguay": "Paraguay", "australia": "Australia", "turkey": "Turquía",
  "türkiye": "Turquía", "turkiye": "Turquía", "brazil": "Brasil",
  "morocco": "Marruecos", "haiti": "Haití", "scotland": "Escocia",
  "germany": "Alemania", "curacao": "Curazao", "curaçao": "Curazao",
  "netherlands": "Países Bajos", "japan": "Japón", "ivory coast": "Costa de Marfil",
  "cote d'ivoire": "Costa de Marfil", "côte d'ivoire": "Costa de Marfil",
  "ecuador": "Ecuador", "sweden": "Suecia", "tunisia": "Túnez", "spain": "España",
  "cape verde": "Cabo Verde", "cabo verde": "Cabo Verde", "belgium": "Bélgica",
  "egypt": "Egipto", "saudi arabia": "Arabia Saudita", "uruguay": "Uruguay",
  "iran": "Irán", "new zealand": "Nueva Zelanda", "france": "Francia",
  "senegal": "Senegal", "iraq": "Irak", "norway": "Noruega", "argentina": "Argentina",
  "algeria": "Argelia", "austria": "Austria", "jordan": "Jordania",
  "portugal": "Portugal", "dr congo": "RD Congo", "congo dr": "RD Congo",
  "democratic republic of congo": "RD Congo", "england": "Inglaterra",
  "croatia": "Croacia", "ghana": "Ghana", "panama": "Panamá",
  "uzbekistan": "Uzbekistán", "colombia": "Colombia",
};

const norm = (s) => (s || "").trim().toLowerCase();
const toES = (name) => EN2ES[norm(name)] || name;
const pairKey = (a, b) => [norm(a), norm(b)].sort().join(" :: ");

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

// Fechas (YYYY-MM-DD UTC) desde 'back' días atrás hasta 'fwd' adelante.
// Hacia adelante para corregir horarios de próximos partidos; hacia atrás
// para resultados recientes.
function recentDates(back = 3, fwd = 13) {
  const out = [];
  for (let i = back; i >= -fwd; i--) {
    out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  }
  return out;
}

function isFinished(ev) {
  const s = (ev.strStatus || "").toLowerCase();
  return s === "ft" || s.includes("finished") || s.includes("aet") || s.includes("pen") || s.includes("after");
}

async function main() {
  // 1) Resultados reales desde TheSportsDB, traídos POR DÍA (estable) y
  //    solo los partidos del Mundial (liga 4429) ya FINALIZADOS.
  const dates = recentDates(3, 13);
  const seen = new Set();
  const events = [];
  for (const d of dates) {
    try {
      const res = await fetch(`https://www.thesportsdb.com/api/v1/json/${SPORTSDB_KEY}/eventsday.php?d=${d}&s=Soccer`);
      if (!res.ok) { console.warn(`día ${d}: HTTP ${res.status}`); continue; }
      const evs = (await res.json()).events || [];
      for (const ev of evs) {
        if (ev.idLeague !== String(LEAGUE)) continue;
        if (seen.has(ev.idEvent)) continue;
        seen.add(ev.idEvent);
        events.push(ev);
      }
    } catch (e) { console.warn(`día ${d}: ${e.message}`); }
  }
  console.log(`Partidos del Mundial encontrados (últimos días): ${events.length}`);

  // 2) Nuestros partidos
  const mRes = await fetch(
    `${SUPABASE_URL}/rest/v1/matches?select=id,home_team,away_team,home_score,away_score,kickoff`,
    { headers }
  );
  if (!mRes.ok) throw new Error(`Supabase GET ${mRes.status}: ${await mRes.text()}`);
  const matches = await mRes.json();
  const idx = new Map();
  for (const m of matches) idx.set(pairKey(m.home_team, m.away_team), m);

  let updated = 0, unchanged = 0, noMatch = 0, pending = 0, horas = 0;

  for (const ev of events) {
    const homeES = toES(ev.strHomeTeam);
    const awayES = toES(ev.strAwayTeam);
    const m = idx.get(pairKey(homeES, awayES));
    if (!m) { noMatch++; continue; }

    // 2a) Sincronizar la HORA del partido (de la fuente confiable, en cualquier estado)
    if (ev.strTimestamp) {
      const ts = ev.strTimestamp.endsWith("Z") || ev.strTimestamp.includes("+") ? ev.strTimestamp : ev.strTimestamp + "Z";
      const nuevaUtc = new Date(ts);
      if (!isNaN(nuevaUtc) && (!m.kickoff || Math.abs(new Date(m.kickoff) - nuevaUtc) > 60000)) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ kickoff: nuevaUtc.toISOString() }),
        });
        if (r.ok) { console.log(`🕒 hora ${m.home_team} vs ${m.away_team} → ${nuevaUtc.toISOString()}`); horas++; m.kickoff = nuevaUtc.toISOString(); }
        else console.error(`❌ hora ${m.home_team}: ${r.status} ${await r.text()}`);
      }
    }

    // 2b) Sincronizar el RESULTADO solo si está FINALIZADO (nunca en vivo)
    if (!isFinished(ev) || ev.intHomeScore == null || ev.intAwayScore == null) { pending++; continue; }
    let hs, as;
    if (norm(m.home_team) === norm(homeES)) { hs = +ev.intHomeScore; as = +ev.intAwayScore; }
    else { hs = +ev.intAwayScore; as = +ev.intHomeScore; }
    if (m.home_score === hs && m.away_score === as) { unchanged++; continue; }

    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/matches?id=eq.${m.id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ home_score: hs, away_score: as }),
    });
    if (!pRes.ok) { console.error(`❌ ${homeES} vs ${awayES}: ${pRes.status} ${await pRes.text()}`); continue; }
    console.log(`✓ ${m.home_team} ${hs}-${as} ${m.away_team}`);
    updated++;
  }

  console.log(`\nResumen → resultados: ${updated} | horas corregidas: ${horas} | sin cambios: ${unchanged} | sin jugar: ${pending} | sin coincidencia: ${noMatch}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
