
-- Enable Realtime for profiles table
begin;
  -- Check if publication exists, if not create it (standard Supabase setup usually has it)
  -- But we just want to add the table.
  
  -- Attempt to add table to publication. 
  -- We do this in a do block to avoid errors if it's already there
  do $$
  begin
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table profiles;
    end if;
  end
  $$;
commit;
