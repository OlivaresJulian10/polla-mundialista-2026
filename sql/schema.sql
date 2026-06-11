-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Esquema de base de datos (Supabase / Postgres)
--  Pega y ejecuta TODO este archivo en:  Supabase -> SQL Editor -> New query
--  Ejecútalo UNA sola vez. Luego ejecuta seed.sql para cargar los grupos.
-- =====================================================================

-- ---------- Limpieza (por si re-ejecutas) ----------
drop table if exists public.predictions cascade;
drop table if exists public.matches cascade;
drop table if exists public.profiles cascade;
drop function if exists public.get_leaderboard() cascade;
drop function if exists public.handle_new_user() cascade;

-- ---------- PERFILES ----------
-- Un perfil por usuario registrado. is_admin lo activas tú manualmente
-- desde el panel de Supabase para poder cargar resultados.
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url   text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- PARTIDOS ----------
-- home_score / away_score quedan NULL hasta que el admin cargue el resultado.
create table public.matches (
  id           bigint generated always as identity primary key,
  stage        text not null default 'group',  -- group, r32, r16, qf, sf, third, final
  group_letter text,                            -- A..L (solo fase de grupos)
  home_team    text not null,
  away_team    text not null,
  kickoff      timestamptz,                     -- fecha/hora de inicio (bloqueo)
  home_score   int,
  away_score   int,
  created_at   timestamptz not null default now()
);

-- ---------- PRONÓSTICOS ----------
create table public.predictions (
  id         bigint generated always as identity primary key,
  user_id    uuid   not null references public.profiles(id) on delete cascade,
  match_id   bigint not null references public.matches(id) on delete cascade,
  pred_home  int not null check (pred_home >= 0),
  pred_away  int not null check (pred_away >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

-- =====================================================================
--  SEGURIDAD (Row Level Security)
-- =====================================================================
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;

-- ----- profiles -----
create policy "perfiles visibles para autenticados"
  on public.profiles for select to authenticated using (true);

create policy "usuario crea su propio perfil"
  on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "usuario edita su propio perfil"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Seguridad: el usuario solo puede cambiar estas columnas de su perfil
-- (NO 'is_admin' ni 'id'), para evitar que se haga administrador solo.
revoke update on public.profiles from authenticated;
grant  update (display_name, avatar_url) on public.profiles to authenticated;

-- ----- matches -----
create policy "partidos visibles para autenticados"
  on public.matches for select to authenticated using (true);

create policy "solo admin administra partidos"
  on public.matches for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- ----- predictions -----
-- Cada usuario solo VE sus propios pronósticos (los demás quedan ocultos).
create policy "usuario lee sus pronosticos"
  on public.predictions for select to authenticated using (user_id = auth.uid());

-- Solo puede crear/editar lo suyo, y SOLO si el partido aún no empezó.
create policy "usuario crea pronostico antes del inicio"
  on public.predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and (m.kickoff is null or m.kickoff > now()))
  );

create policy "usuario edita pronostico antes del inicio"
  on public.predictions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.matches m
                where m.id = match_id and (m.kickoff is null or m.kickoff > now()))
  );

-- =====================================================================
--  CREAR PERFIL AUTOMÁTICAMENTE AL REGISTRARSE
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'display_name', ''),
      split_part(coalesce(new.email,'jugador'), '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
--  TABLA DE POSICIONES (ranking)
--  SECURITY DEFINER: agrega los puntos de TODOS sin exponer los
--  pronósticos individuales de cada quien.
--  Puntaje:  marcador exacto = 5 | acertar resultado = 3 | fallar = 0
-- =====================================================================
create or replace function public.get_leaderboard()
returns table (
  user_id      uuid,
  display_name text,
  points       bigint,
  exacts       bigint,
  hits         bigint,
  played       bigint
)
language sql stable security definer set search_path = public as $$
  select
    pr.id,
    pr.display_name,
    coalesce(sum(
      case
        when m.home_score is null or m.away_score is null then 0
        when p.pred_home = m.home_score and p.pred_away = m.away_score then 5
        when sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) then 3
        else 0
      end), 0) as points,
    coalesce(sum(
      case when m.home_score is not null
            and p.pred_home = m.home_score and p.pred_away = m.away_score
           then 1 else 0 end), 0) as exacts,
    coalesce(sum(
      case
        when m.home_score is null or m.away_score is null then 0
        when p.pred_home = m.home_score and p.pred_away = m.away_score then 1
        when sign(p.pred_home - p.pred_away) = sign(m.home_score - m.away_score) then 1
        else 0
      end), 0) as hits,
    coalesce(sum(case when m.home_score is not null then 1 else 0 end), 0) as played
  from public.profiles pr
  left join public.predictions p on p.user_id = pr.id
  left join public.matches m     on m.id = p.match_id
  group by pr.id, pr.display_name
  order by points desc, exacts desc, pr.display_name asc;
$$;

grant execute on function public.get_leaderboard() to authenticated;
