-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Calendario REAL de la fase de grupos
--  Fechas y emparejamientos oficiales. Horas en HORA COLOMBIA (UTC-5).
--  (Conversión: hora del Este de EE.UU. en junio − 1 hora = hora Colombia.)
--  Fuente: calendario oficial Mundial 2026 (ESPN / FIFA).
--
--  Ejecuta este archivo en SQL Editor DESPUÉS de schema.sql.
--  OJO: borra y recarga los partidos (y por tanto los pronósticos previos).
--       Hazlo ahora que aún no hay pronósticos reales.
-- =====================================================================

truncate table public.matches restart identity cascade;

insert into public.matches (stage, group_letter, home_team, away_team, kickoff) values
-- ===== Jornada 1 =====
('group','A','México','Sudáfrica',                 '2026-06-11 14:00-05'),
('group','A','Corea del Sur','Chequia',            '2026-06-11 21:00-05'),
('group','B','Canadá','Bosnia y Herzegovina',      '2026-06-12 14:00-05'),
('group','D','Estados Unidos','Paraguay',          '2026-06-12 20:00-05'),
('group','B','Catar','Suiza',                      '2026-06-13 14:00-05'),
('group','C','Brasil','Marruecos',                 '2026-06-13 17:00-05'),
('group','C','Haití','Escocia',                    '2026-06-13 20:00-05'),
('group','D','Australia','Turquía',                '2026-06-13 23:00-05'),
('group','E','Alemania','Curazao',                 '2026-06-14 12:00-05'),
('group','F','Países Bajos','Japón',               '2026-06-14 15:00-05'),
('group','E','Costa de Marfil','Ecuador',          '2026-06-14 18:00-05'),
('group','F','Suecia','Túnez',                     '2026-06-14 21:00-05'),
('group','H','España','Cabo Verde',                '2026-06-15 12:00-05'),
('group','G','Bélgica','Egipto',                   '2026-06-15 17:00-05'),
('group','H','Arabia Saudita','Uruguay',           '2026-06-15 17:00-05'),
('group','G','Irán','Nueva Zelanda',               '2026-06-15 23:00-05'),
('group','I','Francia','Senegal',                  '2026-06-16 14:00-05'),
('group','I','Irak','Noruega',                     '2026-06-16 17:00-05'),
('group','J','Argentina','Argelia',                '2026-06-16 20:00-05'),
('group','J','Austria','Jordania',                 '2026-06-16 23:00-05'),
('group','K','Portugal','RD Congo',                '2026-06-17 12:00-05'),
('group','L','Inglaterra','Croacia',               '2026-06-17 15:00-05'),
('group','L','Ghana','Panamá',                     '2026-06-17 18:00-05'),
('group','K','Uzbekistán','Colombia',              '2026-06-17 21:00-05'),
-- ===== Jornada 2 =====
('group','A','Chequia','Sudáfrica',                '2026-06-18 11:00-05'),
('group','B','Suiza','Bosnia y Herzegovina',       '2026-06-18 14:00-05'),
('group','B','Canadá','Catar',                     '2026-06-18 17:00-05'),
('group','A','México','Corea del Sur',             '2026-06-18 22:00-05'),
('group','D','Estados Unidos','Australia',         '2026-06-19 14:00-05'),
('group','C','Escocia','Marruecos',                '2026-06-19 17:00-05'),
('group','C','Brasil','Haití',                     '2026-06-19 20:00-05'),
('group','D','Turquía','Paraguay',                 '2026-06-19 23:00-05'),
('group','F','Países Bajos','Suecia',              '2026-06-20 12:00-05'),
('group','E','Alemania','Costa de Marfil',         '2026-06-20 15:00-05'),
('group','E','Ecuador','Curazao',                  '2026-06-20 19:00-05'),
('group','F','Túnez','Japón',                      '2026-06-20 23:00-05'),
('group','H','España','Arabia Saudita',            '2026-06-21 11:00-05'),
('group','G','Bélgica','Irán',                     '2026-06-21 14:00-05'),
('group','H','Uruguay','Cabo Verde',               '2026-06-21 17:00-05'),
('group','G','Nueva Zelanda','Egipto',             '2026-06-21 20:00-05'),
('group','J','Argentina','Austria',                '2026-06-22 12:00-05'),
('group','I','Francia','Irak',                     '2026-06-22 16:00-05'),
('group','I','Noruega','Senegal',                  '2026-06-22 19:00-05'),
('group','J','Jordania','Argelia',                 '2026-06-22 22:00-05'),
('group','K','Portugal','Uzbekistán',              '2026-06-23 12:00-05'),
('group','L','Inglaterra','Ghana',                 '2026-06-23 15:00-05'),
('group','L','Panamá','Croacia',                   '2026-06-23 18:00-05'),
('group','K','Colombia','RD Congo',                '2026-06-23 21:00-05'),
-- ===== Jornada 3 (partidos simultáneos) =====
('group','B','Suiza','Canadá',                     '2026-06-24 14:00-05'),
('group','B','Bosnia y Herzegovina','Catar',       '2026-06-24 14:00-05'),
('group','C','Escocia','Brasil',                   '2026-06-24 17:00-05'),
('group','C','Marruecos','Haití',                  '2026-06-24 17:00-05'),
('group','A','Chequia','México',                   '2026-06-24 20:00-05'),
('group','A','Sudáfrica','Corea del Sur',          '2026-06-24 20:00-05'),
('group','E','Ecuador','Alemania',                 '2026-06-25 15:00-05'),
('group','E','Curazao','Costa de Marfil',          '2026-06-25 15:00-05'),
('group','F','Japón','Suecia',                     '2026-06-25 18:00-05'),
('group','F','Túnez','Países Bajos',               '2026-06-25 18:00-05'),
('group','D','Turquía','Estados Unidos',           '2026-06-25 21:00-05'),
('group','D','Paraguay','Australia',               '2026-06-25 21:00-05'),
('group','I','Noruega','Francia',                  '2026-06-26 14:00-05'),
('group','I','Senegal','Irak',                     '2026-06-26 14:00-05'),
('group','H','Cabo Verde','Arabia Saudita',        '2026-06-26 19:00-05'),
('group','H','Uruguay','España',                   '2026-06-26 19:00-05'),
('group','G','Egipto','Irán',                      '2026-06-26 22:00-05'),
('group','G','Nueva Zelanda','Bélgica',            '2026-06-26 22:00-05'),
('group','L','Panamá','Inglaterra',                '2026-06-27 16:00-05'),
('group','L','Croacia','Ghana',                    '2026-06-27 16:00-05'),
('group','K','Colombia','Portugal',                '2026-06-27 18:30-05'),
('group','K','RD Congo','Uzbekistán',              '2026-06-27 18:30-05'),
('group','J','Argelia','Austria',                  '2026-06-27 21:00-05'),
('group','J','Jordania','Argentina',               '2026-06-27 21:00-05');

-- Verifica (debe dar 72 y 6 por grupo):
select group_letter, count(*) as partidos
from public.matches where stage='group'
group by group_letter order by group_letter;
