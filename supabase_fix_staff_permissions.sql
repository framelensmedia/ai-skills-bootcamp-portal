-- FIX: Grant Staff permissions for Prompts and Storage
-- Run this in your Supabase SQL Editor

-- 1. PROMPTS TABLE RLS
-- First, drop existing policies if they are too restrictive (or we can just add new ones if we use distinct names)
-- It's safer to CREATE OR REPLACE effectively by creating a new policy name.

-- Allow Staff to INSERT (Create Drafts)
create policy "Allow Staff to Insert Prompts"
on public.prompts
for insert
with check (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role in ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Allow Staff to UPDATE (Save Drafts / Edit)
create policy "Allow Staff to Update Prompts"
on public.prompts
for update
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role in ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Allow Staff to DELETE (Optionally, maybe restricted to own?)
create policy "Allow Staff to Delete Prompts"
on public.prompts
for delete
using (
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role in ('staff', 'admin', 'super_admin', 'editor')
  )
);


-- 2. STORAGE RLS (Bucket: 'prompt-images')

-- Allow Staff to Upload (INSERT)
create policy "Allow Staff to Upload Prompt Images"
on storage.objects
for insert
with check (
  bucket_id = 'prompt-images' and
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role in ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Allow Staff to Update/Replace
create policy "Allow Staff to Update Prompt Images"
on storage.objects
for update
using (
  bucket_id = 'prompt-images' and
  exists (
    select 1 from public.profiles
    where profiles.user_id = auth.uid()
    and profiles.role in ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Allow Staff to View (SELECT) - Usually public, but just in case
create policy "Allow Staff to Select Prompt Images"
on storage.objects
for select
using (
  bucket_id = 'prompt-images'
);
