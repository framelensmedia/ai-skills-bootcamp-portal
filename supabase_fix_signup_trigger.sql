-- Fix handle_new_user to capture metadata robustly
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (user_id, email, role, plan, staff_approved, full_name, profile_image)
  values (
    new.id,
    new.email,
    'user',
    'free',
    false,
    -- Handle both full_name (Standard/Github) and name (Google sometimes)
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    -- Handle avatar_url (Github) and picture (Google)
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  )
  on conflict (user_id)
  do update set
    email = excluded.email,
    -- Only update name/image if provided in metadata, otherwise keep existing
    full_name = COALESCE(excluded.full_name, public.profiles.full_name),
    profile_image = COALESCE(excluded.profile_image, public.profiles.profile_image);

  return new;
end;
$$;
