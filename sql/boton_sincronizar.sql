-- =====================================================================
--  POLLA MUNDIALISTA 2026 — Función para el botón "Sincronizar resultados"
--  Permite que un ADMIN dispare el robot desde la app (un clic).
--  Requiere pg_net activo (ya lo activaste para el cron).
--
--  Reemplaza TU_GITHUB_TOKEN por el mismo token del cron y ejecútalo.
--  (No subas este archivo con el token real: el repo es público.)
-- =====================================================================

create or replace function public.trigger_sync()
returns text
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Solo administradores';
  end if;

  perform net.http_post(
    url     := 'https://api.github.com/repos/OlivaresJulian10/polla-mundialista-2026/actions/workflows/resultados.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer TU_GITHUB_TOKEN',
      'Accept',        'application/vnd.github+json',
      'User-Agent',    'supabase-cron',
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object('ref', 'main')
  );
  return 'ok';
end;
$$;

grant execute on function public.trigger_sync() to authenticated;
