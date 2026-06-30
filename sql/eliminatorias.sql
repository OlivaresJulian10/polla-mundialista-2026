-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Eliminatorias: 16avos (R32) y Octavos (R16)
--  Equipos y fechas desde football-data (los "Por definir" se llenan solos
--  cuando se definan). Ejecuta una vez en SQL Editor. No borra grupos.
-- =====================================================================

-- id externo (football-data) para que el robot mantenga equipos/fecha/resultado al día
alter table public.matches add column if not exists ext_id bigint;

-- Recargar solo estas rondas (no toca grupos ni pronósticos de grupos)
delete from public.matches where stage in ('r32','r16');

insert into public.matches (stage, group_letter, home_team, away_team, kickoff, ext_id) values
('r32', null, 'Sudáfrica', 'Canadá', '2026-06-28T19:00:00Z', 537417),
('r32', null, 'Brasil', 'Japón', '2026-06-29T17:00:00Z', 537423),
('r32', null, 'Alemania', 'Paraguay', '2026-06-29T20:30:00Z', 537415),
('r32', null, 'Países Bajos', 'Marruecos', '2026-06-30T01:00:00Z', 537418),
('r32', null, 'Costa de Marfil', 'Noruega', '2026-06-30T17:00:00Z', 537424),
('r32', null, 'Francia', 'Suecia', '2026-06-30T21:00:00Z', 537416),
('r32', null, 'México', 'Ecuador', '2026-07-01T01:00:00Z', 537425),
('r32', null, 'Inglaterra', 'RD Congo', '2026-07-01T16:00:00Z', 537426),
('r32', null, 'Bélgica', 'Senegal', '2026-07-01T20:00:00Z', 537422),
('r32', null, 'Estados Unidos', 'Bosnia y Herzegovina', '2026-07-02T00:00:00Z', 537421),
('r32', null, 'España', 'Austria', '2026-07-02T19:00:00Z', 537420),
('r32', null, 'Portugal', 'Croacia', '2026-07-02T23:00:00Z', 537419),
('r32', null, 'Suiza', 'Argelia', '2026-07-03T03:00:00Z', 537429),
('r32', null, 'Australia', 'Egipto', '2026-07-03T18:00:00Z', 537428),
('r32', null, 'Argentina', 'Cabo Verde', '2026-07-03T22:00:00Z', 537427),
('r32', null, 'Colombia', 'Ghana', '2026-07-04T01:30:00Z', 537430),
('r16', null, 'Canadá', 'Marruecos', '2026-07-04T17:00:00Z', 537376),
('r16', null, 'Paraguay', 'Por definir', '2026-07-04T21:00:00Z', 537375),
('r16', null, 'Brasil', 'Por definir', '2026-07-05T20:00:00Z', 537377),
('r16', null, 'Por definir', 'Por definir', '2026-07-06T00:00:00Z', 537378),
('r16', null, 'Por definir', 'Por definir', '2026-07-06T19:00:00Z', 537379),
('r16', null, 'Por definir', 'Por definir', '2026-07-07T00:00:00Z', 537380),
('r16', null, 'Por definir', 'Por definir', '2026-07-07T16:00:00Z', 537381),
('r16', null, 'Por definir', 'Por definir', '2026-07-07T20:00:00Z', 537382);

select stage, count(*) from public.matches where stage in ('r32','r16') group by stage;
