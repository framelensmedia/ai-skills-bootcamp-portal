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
drop policy if exists "Users can view their own video generations" on public.video_generations;
create policy "Users can view their own video generations"
    on public.video_generations for select
    using (auth.uid() = user_id);

drop policy if exists "Anyone can view public videos" on public.video_generations;
create policy "Anyone can view public videos"
    on public.video_generations for select
    using (is_public = true);

drop policy if exists "Users can insert their own video generations" on public.video_generations;
create policy "Users can insert their own video generations"
    on public.video_generations for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update their own video generations" on public.video_generations;
create policy "Users can update their own video generations"
    on public.video_generations for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "Service role can do anything" on public.video_generations;
create policy "Service role can do anything"
    on public.video_generations for all
    using (true)
    with check (true);

-- Ensure 'generations' bucket exists (already does), but we will store videos in 'generations/videos/{userId}/{id}.mp4'

-- =====================================================
-- VIDEO UPVOTES TABLE
-- =====================================================
create table if not exists public.video_upvotes (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    video_id uuid not null references public.video_generations(id) on delete cascade,
    created_at timestamp with time zone default now(),
    
    constraint video_upvotes_pkey primary key (id),
    constraint video_upvotes_unique unique (user_id, video_id)
);

alter table public.video_upvotes enable row level security;

drop policy if exists "Users can view video upvotes" on public.video_upvotes;
create policy "Users can view video upvotes"
    on public.video_upvotes for select
    using (true);

drop policy if exists "Users can insert their own video upvotes" on public.video_upvotes;
create policy "Users can insert their own video upvotes"
    on public.video_upvotes for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own video upvotes" on public.video_upvotes;
create policy "Users can delete their own video upvotes"
    on public.video_upvotes for delete
    using (auth.uid() = user_id);

-- =====================================================
-- VIDEO FAVORITES TABLE
-- =====================================================
create table if not exists public.video_favorites (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    video_id uuid not null references public.video_generations(id) on delete cascade,
    folder_id uuid references public.folders(id) on delete set null,
    created_at timestamp with time zone default now(),
    
    constraint video_favorites_pkey primary key (id),
    constraint video_favorites_unique unique (user_id, video_id)
);

alter table public.video_favorites enable row level security;

drop policy if exists "Users can view their own video favorites" on public.video_favorites;
create policy "Users can view their own video favorites"
    on public.video_favorites for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert their own video favorites" on public.video_favorites;
create policy "Users can insert their own video favorites"
    on public.video_favorites for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own video favorites" on public.video_favorites;
create policy "Users can delete their own video favorites"
    on public.video_favorites for delete
    using (auth.uid() = user_id);
