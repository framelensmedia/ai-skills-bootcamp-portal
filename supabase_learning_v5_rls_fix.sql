
-- Relax RLS policies for lesson_contents to allow easier editing during development
-- Ideally we'd check for admin role, but for now just authenticated is fine for the CMS usage

-- Drop existing restrictive policies
drop policy if exists "Authenticated Admin Insert" on public.lesson_contents;
drop policy if exists "Authenticated Admin Update" on public.lesson_contents;
drop policy if exists "Authenticated Admin Delete" on public.lesson_contents;

-- Create permissive policies for authenticated users
create policy "Authenticated Users Can Insert"
    on public.lesson_contents for insert
    with check (auth.role() = 'authenticated');

create policy "Authenticated Users Can Update"
    on public.lesson_contents for update
    using (auth.role() = 'authenticated');

create policy "Authenticated Users Can Delete"
    on public.lesson_contents for delete
    using (auth.role() = 'authenticated');
