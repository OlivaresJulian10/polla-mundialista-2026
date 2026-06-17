-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Disparador CONFIABLE del robot de resultados
--  Hace que SUPABASE llame al robot de GitHub cada 3 minutos (de verdad),
--  en vez de depender del horario poco fiable de GitHub.
--
--  PASOS PREVIOS (una sola vez):
--   1) Supabase → Database → Extensions → activa  pg_cron  y  pg_net.
--   2) Crea un GitHub token (fine-grained) con permiso
--      "Actions: Read and write" SOLO sobre el repo polla-mundialista-2026.
--      (GitHub → Settings → Developer settings → Fine-grained tokens)
--   3) Pega ese token abajo donde dice TU_GITHUB_TOKEN y ejecuta este SQL.
-- =====================================================================

-- (Re)programar el disparo cada 3 minutos
select cron.unschedule('disparar-resultados')
where exists (select 1 from cron.job where jobname = 'disparar-resultados');

select cron.schedule(
  'disparar-resultados',
  '*/3 * * * *',
  $$
  select net.http_post(
    url     := 'https://api.github.com/repos/OlivaresJulian10/polla-mundialista-2026/actions/workflows/resultados.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TU_GITHUB_TOKEN',
      'Accept',        'application/vnd.github+json',
      'User-Agent',    'supabase-cron',
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('ref', 'main')
  );
  $$
);

-- Ver que quedó programado:
select jobname, schedule, active from cron.job where jobname = 'disparar-resultados';
