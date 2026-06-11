-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Vistas de administrador (participación)
--  Ejecuta este archivo UNA vez en SQL Editor. No borra datos.
--  Solo los administradores pueden ejecutar estas funciones.
-- =====================================================================

-- 1) Resumen: quién ha pronosticado, cuántos y cuándo fue su último cambio
drop function if exists public.admin_participation();
create or replace function public.admin_participation()
returns table (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  total        bigint,
  last_update  timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Solo administradores';
  end if;

  return query
    select pr.id, pr.display_name, pr.avatar_url,
           count(p.id)::bigint, max(p.updated_at)
    from public.profiles pr
    left join public.predictions p on p.user_id = pr.id
    group by pr.id, pr.display_name, pr.avatar_url
    order by count(p.id) desc, pr.display_name asc;
end;
$$;
grant execute on function public.admin_participation() to authenticated;

-- 2) Detalle: los pronósticos de UN usuario (para que el admin los revise)
drop function if exists public.admin_user_predictions(uuid);
create or replace function public.admin_user_predictions(p_user uuid)
returns table (
  match_id     bigint,
  group_letter text,
  kickoff      timestamptz,
  home_team    text,
  away_team    text,
  pred_home    int,
  pred_away    int,
  home_score   int,
  away_score   int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Solo administradores';
  end if;

  return query
    select m.id, m.group_letter, m.kickoff, m.home_team, m.away_team,
           p.pred_home, p.pred_away, m.home_score, m.away_score
    from public.predictions p
    join public.matches m on m.id = p.match_id
    where p.user_id = p_user
    order by m.kickoff asc, m.id asc;
end;
$$;
grant execute on function public.admin_user_predictions(uuid) to authenticated;
