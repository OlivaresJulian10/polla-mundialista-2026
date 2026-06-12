-- =====================================================================
--  DIAGNÓSTICO — ¿por qué se ven pronósticos al revés?
--  Ejecuta cada consulta en SQL Editor y pásame los resultados.
--  Solo LEE datos, no cambia nada.
-- =====================================================================

-- 1) ¿Cómo está guardado el partido Corea del Sur vs Chequia?
--    Fíjate en home_team / away_team: ¿quién quedó como local?
select id, group_letter, home_team, away_team, home_score, away_score, kickoff
from public.matches
where 'Corea del Sur' in (home_team, away_team)
  and 'Chequia'      in (home_team, away_team);

-- 2) Pronósticos guardados de ese partido (qué puso cada quién)
select pr.display_name,
       m.home_team, p.pred_home, p.pred_away, m.away_team,
       p.updated_at
from public.predictions p
join public.profiles pr on pr.id = p.user_id
join public.matches  m  on m.id = p.match_id
where 'Corea del Sur' in (m.home_team, m.away_team)
  and 'Chequia'      in (m.home_team, m.away_team)
order by p.updated_at;

-- 3) ¿Hay partidos DUPLICADOS (mismos equipos repetidos)? Eso causaría líos.
select home_team, away_team, count(*) as veces
from public.matches
group by home_team, away_team
having count(*) > 1;

-- 4) Lista completa de partidos como están guardados (para ver si alguno
--    quedó con el local/visitante invertido respecto al calendario real).
select id, group_letter, home_team, away_team, home_score, away_score
from public.matches
order by kickoff, id;
