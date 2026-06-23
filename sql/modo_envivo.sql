-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Modo EN VIVO
--  Agrega el estado del partido (programado / en vivo / finalizado).
--  Ejecuta una vez en SQL Editor. No borra datos.
-- =====================================================================
alter table public.matches add column if not exists status text not null default 'scheduled';
-- status: 'scheduled' (por jugar) | 'live' (en vivo) | 'finished' (terminado)
