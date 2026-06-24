-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Minuto exacto en vivo (API-Football)
--  Ejecuta una vez en SQL Editor. No borra datos.
-- =====================================================================
alter table public.matches add column if not exists live_minute    int;          -- minuto al momento de consultar
alter table public.matches add column if not exists live_minute_at  timestamptz;  -- cuándo se consultó (para "correr" el reloj)
