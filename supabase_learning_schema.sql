-- Add gamification fields to profiles
alter table public.profiles 
add column if not exists xp integer default 0,
add column if not exists streak_days integer default 0,
add column if not exists last_activity_date timestamp with time zone;

-- Create lesson_video_progress table
create table if not exists public.lesson_video_progress (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    video_index integer not null,
    is_completed boolean default false,
    updated_at timestamp with time zone default now(),
    
    constraint lesson_video_progress_pkey primary key (id),
    constraint lesson_video_progress_unique unique (user_id, lesson_id, video_index)
);

-- Enable RLS
alter table public.lesson_video_progress enable row level security;

-- Policies
create policy "Users can view their own video progress"
    on public.lesson_video_progress for select
    using (auth.uid() = user_id);

create policy "Users can insert/update their own video progress"
    on public.lesson_video_progress for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Storage bucket for bootcamp videos
insert into storage.buckets (id, name, public)
values ('bootcamp-videos', 'bootcamp-videos', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'bootcamp-videos' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'bootcamp-videos' and auth.role() = 'authenticated' );

create policy "Users can update their own uploads"
  on storage.objects for update
  using ( bucket_id = 'bootcamp-videos' and auth.uid() = owner )
  with check ( bucket_id = 'bootcamp-videos' and auth.uid() = owner );

create policy "Users can delete their own uploads"
  on storage.objects for delete
  using ( bucket_id = 'bootcamp-videos' and auth.uid() = owner );
