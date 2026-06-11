-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Carga de grupos y partidos (fase de grupos)
--  Ejecuta este archivo DESPUÉS de schema.sql.
--
--  Grupos según el Sorteo Final (Washington D.C., 5 de diciembre de 2025).
--  >>> VERIFICA los equipos contra la fuente oficial y corrígelos si hace
--      falta desde el panel de Admin de la app.
--
--  Las fechas (kickoff) son TENTATIVAS para que funcione el bloqueo;
--  ajústalas con las horas reales desde el panel de Admin.
-- =====================================================================

-- Limpia partidos previos (no toca pronósticos de usuarios si re-cargas
-- antes de que alguien juegue; si ya hay pronósticos, el ON DELETE CASCADE
-- los borraría — re-carga solo en pruebas).
truncate table public.matches restart identity cascade;

do $$
declare
  g    record;
  base timestamptz := timestamptz '2026-06-11 12:00:00-05';  -- inicio tentativo
  step interval    := interval '3 hour';
  i    int := 0;
begin
  for g in
    select group_letter,
           max(team) filter (where pos = 1) as t1,
           max(team) filter (where pos = 2) as t2,
           max(team) filter (where pos = 3) as t3,
           max(team) filter (where pos = 4) as t4
    from (values
      ('A',1,'México'),       ('A',2,'Sudáfrica'),   ('A',3,'Corea del Sur'), ('A',4,'Chequia'),
      ('B',1,'Canadá'),       ('B',2,'Suiza'),       ('B',3,'Bosnia y Herzegovina'), ('B',4,'Catar'),
      ('C',1,'Brasil'),       ('C',2,'Escocia'),     ('C',3,'Marruecos'),     ('C',4,'Haití'),
      ('D',1,'Estados Unidos'),('D',2,'Turquía'),    ('D',3,'Paraguay'),      ('D',4,'Australia'),
      ('E',1,'Alemania'),     ('E',2,'Costa de Marfil'),('E',3,'Ecuador'),    ('E',4,'Curazao'),
      ('F',1,'Países Bajos'), ('F',2,'Suecia'),      ('F',3,'Japón'),         ('F',4,'Túnez'),
      ('G',1,'Bélgica'),      ('G',2,'Irán'),        ('G',3,'Egipto'),        ('G',4,'Nueva Zelanda'),
      ('H',1,'España'),       ('H',2,'Arabia Saudita'),('H',3,'Uruguay'),     ('H',4,'Cabo Verde'),
      ('I',1,'Francia'),      ('I',2,'Irak'),        ('I',3,'Noruega'),       ('I',4,'Senegal'),
      ('J',1,'Argentina'),    ('J',2,'Austria'),     ('J',3,'Jordania'),      ('J',4,'Argelia'),
      ('K',1,'Portugal'),     ('K',2,'Colombia'),    ('K',3,'Uzbekistán'),    ('K',4,'RD Congo'),
      ('L',1,'Inglaterra'),   ('L',2,'Croacia'),     ('L',3,'Ghana'),         ('L',4,'Panamá')
    ) as v(group_letter, pos, team)
    group by group_letter
    order by group_letter
  loop
    -- 6 partidos por grupo (todos contra todos)
    insert into public.matches (stage, group_letter, home_team, away_team, kickoff) values
      ('group', g.group_letter, g.t1, g.t2, base + (i+0) * step),
      ('group', g.group_letter, g.t3, g.t4, base + (i+1) * step),
      ('group', g.group_letter, g.t1, g.t3, base + (i+2) * step),
      ('group', g.group_letter, g.t4, g.t2, base + (i+3) * step),
      ('group', g.group_letter, g.t1, g.t4, base + (i+4) * step),
      ('group', g.group_letter, g.t2, g.t3, base + (i+5) * step);
    i := i + 6;
  end loop;
end $$;

-- Verifica:
select group_letter, count(*) as partidos
from public.matches
where stage = 'group'
group by group_letter
order by group_letter;
