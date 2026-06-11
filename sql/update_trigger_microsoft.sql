-- =====================================================================
--  Actualiza SOLO la función que crea el perfil, para tomar el nombre
--  de la cuenta de Microsoft. Ejecútalo en SQL Editor.
--  (No borra tablas ni datos.)
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
