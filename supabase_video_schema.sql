-- Create the video_generations table
create table if not exists public.video_generations (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    source_image_id uuid references public.prompt_generations(id),
    video_url text,
    prompt text,
    dialogue text,
    status text default 'pending', -- pending, completed, failed
    is_public boolean default false,
    upvotes_count integer default 0,
    created_at timestamp with time zone default now(),
    
    constraint video_generations_pkey primary key (id)
);

-- Enable RLS
alter table public.video_generations enable row level security;

-- Policies
create policy "Users can view their own video generations"
    on public.video_generations for select
    using (auth.uid() = user_id);

create policy "Anyone can view public videos"
    on public.video_generations for select
    using (is_public = true);

create policy "Users can insert their own video generations"
    on public.video_generations for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own video generations"
    on public.video_generations for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Service role can do anything"
    on public.video_generations for all
    using (true)
    with check (true);

-- Ensure 'generations' bucket exists (already does), but we will store videos in 'generations/videos/{userId}/{id}.mp4'
