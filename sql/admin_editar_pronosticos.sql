-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Admin: llenar/corregir pronósticos de otros
--  Ejecuta este archivo UNA vez en SQL Editor. No borra datos.
--  Solo los administradores pueden usar estas funciones.
-- =====================================================================

-- 1) Ver TODOS los partidos de un usuario (con o sin pronóstico),
--    para que el admin pueda llenar los que falten.
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
    from public.matches m
    left join public.predictions p
      on p.match_id = m.id and p.user_id = p_user
    order by m.kickoff asc, m.id asc;
end;
$$;
grant execute on function public.admin_user_predictions(uuid) to authenticated;

-- 2) Guardar/editar pronósticos de un usuario (IGNORA el bloqueo de 10 min).
--    p_data es un arreglo JSON: [{"match_id":1,"home":2,"away":1}, ...]
create or replace function public.admin_set_predictions(p_user uuid, p_data jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  n integer := 0;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Solo administradores';
  end if;

  for r in select value from jsonb_array_elements(p_data) loop
    if (r->>'home') is null or (r->>'away') is null then
      delete from public.predictions
       where user_id = p_user and match_id = (r->>'match_id')::bigint;
    else
      insert into public.predictions (user_id, match_id, pred_home, pred_away, updated_at)
      values (p_user, (r->>'match_id')::bigint, (r->>'home')::int, (r->>'away')::int, now())
      on conflict (user_id, match_id) do update
        set pred_home = excluded.pred_home,
            pred_away = excluded.pred_away,
            updated_at = now();
    end if;
    n := n + 1;
  end loop;

  return n;
end;
$$;
grant execute on function public.admin_set_predictions(uuid, jsonb) to authenticated;
