// =====================================================================
//  Envía correos recordatorio vía Microsoft Graph (Microsoft 365).
//  Se ejecuta solo desde GitHub Actions cada mañana (8 a.m. Colombia).
//  Avisa a quienes les faltan partidos de HOY por pronosticar.
// =====================================================================

const TENANT  = process.env.AZURE_TENANT_ID  || "0516f8d0-1ec9-483e-b936-c1b2859a8970";
const CLIENT  = process.env.AZURE_CLIENT_ID  || "3f0e516c-e290-4f47-a760-9f7a386def74";
const SECRET  = process.env.AZURE_CLIENT_SECRET;
const SENDER  = process.env.MAIL_SENDER || "soporte.cys@hidroituango.com.co";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://ucaalcrdujucpdnmxjsd.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const APP_URL = "https://mundial.hidroituango.com.co";
const TROFEO  = APP_URL + "/img/trofeo.png";

if (!SECRET || !SERVICE_KEY) {
  console.error("❌ Faltan secrets: AZURE_CLIENT_SECRET y/o SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const horaCol = (iso) =>
  new Date(iso).toLocaleString("es-CO", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "America/Bogota",
  });

function buildEmail(name, matches) {
  const filas = matches.map((m) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:15px;color:#111827;">
        <b>${m.home_team}</b> <span style="color:#9ca3af;">vs</span> <b>${m.away_team}</b>
      </td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#16a34a;text-align:right;white-space:nowrap;">
        🕒 ${horaCol(m.kickoff)}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#0e1117;font-family:Segoe UI,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e1117;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:24px;text-align:center;">
          <img src="${TROFEO}" alt="Trofeo" width="90" style="display:block;margin:0 auto 8px;background:#fff;border-radius:14px;padding:6px;" />
          <div style="color:#fff;font-size:20px;font-weight:800;">Polla Mundialista 2026</div>
          <div style="color:#dcfce7;font-size:13px;">Hidroituango S.A.</div>
        </td></tr>
        <tr><td style="padding:26px 26px 8px;">
          <p style="font-size:17px;color:#111827;margin:0 0 6px;">¡Hola, ${name}! 👋</p>
          <p style="font-size:15px;color:#374151;margin:0 0 18px;line-height:1.5;">
            Te faltan pronósticos para los partidos de <b>hoy</b>. ¡No te quedes sin sumar puntos!
            Recuerda que cada partido se cierra <b>10 minutos antes</b> de empezar.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            ${filas}
          </table>
          <div style="text-align:center;margin:24px 0 8px;">
            <a href="${APP_URL}" style="background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:13px 30px;border-radius:10px;display:inline-block;">
              ⚽ Pronosticar ahora
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:12px 26px 24px;text-align:center;color:#9ca3af;font-size:12px;">
          Marcador exacto = 5 pts · Acertar resultado = 3 pts · Fallar = 0<br/>
          <a href="${APP_URL}" style="color:#16a34a;">${APP_URL.replace("https://", "")}</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT, client_secret: SECRET,
      scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error("Token Microsoft: " + JSON.stringify(j));
  return j.access_token;
}

async function getReminders() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reminders_today`, {
    method: "POST",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error("Supabase: " + res.status + " " + (await res.text()));
  return res.json();
}

async function sendMail(token, email, html) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(SENDER)}/sendMail`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: "⚽ ¡No olvides tu pronóstico de hoy! — Polla Mundialista",
        body: { contentType: "HTML", content: html },
        toRecipients: [{ emailAddress: { address: email } }],
      },
      saveToSentItems: false,
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

async function main() {
  const rows = await getReminders();
  console.log(`Partidos pendientes (filas): ${rows.length}`);
  // Agrupar por usuario
  const byUser = {};
  for (const r of rows) {
    (byUser[r.email] ||= { name: r.display_name, matches: [] }).matches.push(r);
  }
  const usuarios = Object.entries(byUser);
  if (!usuarios.length) { console.log("Nadie por recordar hoy. 🎉"); return; }

  const token = await getToken();
  let ok = 0, fail = 0;
  for (const [email, info] of usuarios) {
    try {
      await sendMail(token, email, buildEmail(info.name, info.matches));
      console.log(`✓ ${email} (${info.matches.length} partidos)`);
      ok++;
    } catch (e) {
      console.error(`✗ ${email}: ${e.message}`);
      fail++;
    }
  }
  console.log(`\nResumen → enviados: ${ok} | fallidos: ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
