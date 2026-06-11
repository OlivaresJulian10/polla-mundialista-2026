-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Fotos de perfil (avatares)
--  Ejecuta este archivo UNA vez en SQL Editor (después de schema.sql).
--  No borra datos.
-- =====================================================================

-- 1) Columna para la URL de la foto
alter table public.profiles add column if not exists avatar_url text;

-- 2) Bucket de almacenamiento público para las fotos
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- 3) Reglas del bucket:
--    - Cualquiera puede VER las fotos (lectura pública).
--    - Cada usuario solo puede subir/cambiar las suyas (carpeta = su id).
drop policy if exists "avatars lectura publica"   on storage.objects;
drop policy if exists "avatars subir propio"       on storage.objects;
drop policy if exists "avatars actualizar propio"  on storage.objects;

create policy "avatars lectura publica"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars subir propio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars actualizar propio"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Incluir la foto en la tabla de posiciones
drop function if exists public.get_leaderboard();
create or replace function public.get_leaderboard()
returns table (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  points       bigint,
  exacts       bigint,
  hits         bigint,
  played       bigint
)
language sql stable security definer set search_path = public as $$
  select
    pr.id,
    pr.display_name,
    pr.avatar_url,
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
  group by pr.id, pr.display_name, pr.avatar_url
  order by points desc, exacts desc, pr.display_name asc;
$$;

grant execute on function public.get_leaderboard() to authenticated;
