-- Migration to v2 Learning Flow: Mixed Content

-- 1. Create lesson_contents table
-- This replaces the concept of 'lesson_videos' with a generic content table
-- Type can be 'video', 'exercise', 'text', etc.
create table if not exists public.lesson_contents (
    id uuid not null default gen_random_uuid(),
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    type text not null check (type in ('video', 'exercise', 'text')),
    order_index integer not null default 0,
    title text,
    content jsonb not null default '{}'::jsonb, 
    -- For video: { video_url, duration_seconds, thumbnail_url }
    -- For exercise: { question, options: [], correct_answer_index, explanation }
    is_published boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),

    constraint lesson_contents_pkey primary key (id)
);

-- Enable RLS
alter table public.lesson_contents enable row level security;

-- Policies for lesson_contents
create policy "Public Read Access"
    on public.lesson_contents for select
    using (true);

create policy "Authenticated Admin Insert"
    on public.lesson_contents for insert
    with check (auth.role() = 'authenticated'); -- Ideally restrict to admins

create policy "Authenticated Admin Update"
    on public.lesson_contents for update
    using (auth.role() = 'authenticated');

create policy "Authenticated Admin Delete"
    on public.lesson_contents for delete
    using (auth.role() = 'authenticated');
    
-- 2. Update user progress tracking
-- We can reuse lesson_video_progress but rename it or create a new view/table
-- For simplicity and backward compatibility, let's create a new table
create table if not exists public.lesson_content_progress (
    id uuid not null default gen_random_uuid(),
    user_id uuid not null references auth.users(id),
    lesson_id uuid not null references public.lessons(id) on delete cascade,
    content_id uuid not null references public.lesson_contents(id) on delete cascade,
    is_completed boolean default false,
    updated_at timestamp with time zone default now(),
    
    constraint lesson_content_progress_pkey primary key (id),
    constraint lesson_content_progress_unique unique (user_id, content_id)
);

-- Enable RLS
alter table public.lesson_content_progress enable row level security;

-- Policies for progress
create policy "Users can view their own content progress"
    on public.lesson_content_progress for select
    using (auth.uid() = user_id);

create policy "Users can update their own content progress"
    on public.lesson_content_progress for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
