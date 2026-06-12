-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Correos recordatorio (Microsoft Graph)
--  Ejecuta este archivo UNA vez en SQL Editor. No borra datos.
-- =====================================================================

-- 1) Guardar el correo de cada jugador en su perfil
alter table public.profiles add column if not exists email text;

-- 2) El trigger de nuevo usuario también guarda el correo
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email,'jugador'), '@', 1)
    ),
    new.email
  );
  return new;
end;
$$;

-- 3) Rellenar el correo de los que ya estaban registrados
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and (p.email is null or p.email = '');

-- 4) Función: a quién recordarle HOY (partidos de hoy aún abiertos y sin pronosticar),
--    incluyendo su posición y puntos en el ranking (para el mensaje motivador).
--    Solo la usa el robot (service_role). Devuelve un correo por cada partido pendiente.
drop function if exists public.reminders_today();
create or replace function public.reminders_today()
returns table (
  email           text,
  display_name    text,
  puntos          bigint,
  posicion        bigint,
  total_jugadores bigint,
  home_team       text,
  away_team       text,
  kickoff         timestamptz
)
language sql stable security definer set search_path = public as $$
  with lb as (
    select pr.id,
      coalesce(sum(
        case
          when m.home_score is null or m.away_score is null then 0
          when p.pred_home = m.home_score and p.pred_away = m.away_score then 5
          when sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) then 3
          else 0
        end), 0) as puntos
    from public.profiles pr
    left join public.predictions p on p.user_id = pr.id
    left join public.matches m     on m.id = p.match_id
    group by pr.id
  ),
  ranked as (
    select id, puntos,
           rank() over (order by puntos desc) as posicion,
           count(*) over () as total_jugadores
    from lb
  )
  select pr.email, pr.display_name, r.puntos, r.posicion, r.total_jugadores,
         mm.home_team, mm.away_team, mm.kickoff
  from public.profiles pr
  join ranked r on r.id = pr.id
  join public.matches mm
    on mm.kickoff is not null
   and (mm.kickoff at time zone 'America/Bogota')::date
       = (now() at time zone 'America/Bogota')::date    -- se juega hoy (Colombia)
   and now() < mm.kickoff - interval '10 minutes'         -- aún se puede pronosticar
  left join public.predictions pp
    on pp.user_id = pr.id and pp.match_id = mm.id
  where pr.email is not null
    and pp.id is null                                      -- no lo ha pronosticado
  order by pr.email, mm.kickoff;
$$;

revoke execute on function public.reminders_today() from public, anon, authenticated;
grant  execute on function public.reminders_today() to service_role;
