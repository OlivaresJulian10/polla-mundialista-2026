-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Permisos de guardado + bloqueo a 10 min
--  Ejecuta este archivo UNA vez en SQL Editor. No borra datos.
--
--  Hace 2 cosas:
--   1) GARANTIZA que los usuarios puedan guardar sus pronósticos
--      (concede el permiso de la tabla; si faltaba, por eso "no guardaba").
--   2) Cierra la edición 10 MINUTOS ANTES del inicio de cada partido,
--      a nivel de base de datos (imposible saltárselo).
-- =====================================================================

-- 1) Permisos de tabla para los usuarios autenticados
grant select, insert, update on public.predictions to authenticated;

-- 2) Recrear las reglas con el bloqueo de 10 minutos antes
drop policy if exists "usuario crea pronostico antes del inicio"   on public.predictions;
drop policy if exists "usuario edita pronostico antes del inicio"   on public.predictions;
drop policy if exists "usuario crea pronostico hasta 10 min antes"  on public.predictions;
drop policy if exists "usuario edita pronostico hasta 10 min antes" on public.predictions;

create policy "usuario crea pronostico hasta 10 min antes"
  on public.predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.kickoff is not null
        and now() < m.kickoff - interval '10 minutes'
    )
  );

create policy "usuario edita pronostico hasta 10 min antes"
  on public.predictions for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.kickoff is not null
        and now() < m.kickoff - interval '10 minutes'
    )
  );

-- (La regla de lectura "usuario lee sus pronosticos" se mantiene igual.)
