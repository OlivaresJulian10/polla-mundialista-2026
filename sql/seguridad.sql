-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Refuerzos de seguridad
--  Ejecuta este archivo UNA vez en SQL Editor. No borra datos.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) IMPEDIR ESCALADA DE PRIVILEGIOS
--    Aunque un usuario puede editar SU perfil, NO debe poder cambiar
--    'is_admin' ni 'id'. Limitamos las columnas editables a nivel de
--    permisos: solo display_name y avatar_url.
-- ---------------------------------------------------------------------
revoke update on public.profiles from authenticated;
revoke update on public.profiles from anon;
grant  update (display_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 2) ASEGURAR QUE RLS ESTÉ ACTIVO EN TODAS LAS TABLAS
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.matches     enable row level security;
alter table public.predictions enable row level security;
-- 'force' aplica RLS incluso al dueño de la tabla (defensa extra)
alter table public.profiles    force row level security;
alter table public.predictions force row level security;

-- ---------------------------------------------------------------------
-- 3) LÍMITES EN LAS FOTOS DE PERFIL (bucket avatars)
--    Máx 3 MB y solo formatos de imagen comunes.
-- ---------------------------------------------------------------------
update storage.buckets
set file_size_limit = 3145728,  -- 3 MB
    allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif']
where id = 'avatars';

-- ---------------------------------------------------------------------
-- 4) Verificación: ¿qué tablas tienen RLS habilitado?
-- ---------------------------------------------------------------------
select tablename, rowsecurity as rls_activo
from pg_tables
where schemaname = 'public'
order by tablename;
