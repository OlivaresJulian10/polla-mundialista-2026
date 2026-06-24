-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Eventos en vivo (goles, cambios, tarjetas)
--  Ejecuta una vez en SQL Editor. No borra datos.
-- =====================================================================
alter table public.matches add column if not exists live_events jsonb;
