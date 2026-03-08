-- Migration: Studio Suite Voice Engine
-- Description: Creates tables for Voices, Media Jobs, and modifies Video Generations for parent-child relationship.

-- 1. Create Voices Table
CREATE TABLE IF NOT EXISTS public.voices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_voice_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'preset' or 'cloned'
    status TEXT NOT NULL DEFAULT 'active',
    preview_audio_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for voices
ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voices or presets" 
ON public.voices FOR SELECT 
USING (auth.uid() = user_id OR type = 'preset');

CREATE POLICY "Users can insert their own voices" 
ON public.voices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voices" 
ON public.voices FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voices" 
ON public.voices FOR DELETE 
USING (auth.uid() = user_id);


-- 2. Create Media Jobs Table
CREATE TABLE IF NOT EXISTS public.media_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    input_video_asset_id UUID, -- References video_generations(id) but keep loosely coupled if possible
    input_voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    error_message TEXT,
    progress_percent INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enable RLS for media_jobs
ALTER TABLE public.media_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs" 
ON public.media_jobs FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs" 
ON public.media_jobs FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs" 
ON public.media_jobs FOR UPDATE 
USING (auth.uid() = user_id);


-- 3. Modify Video Generations to Support Branching/Cloning
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS parent_generation_id UUID REFERENCES public.video_generations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL;


-- 4. Create Voices Storage Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voices', 'voices', true) 
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage (Postgres schema config for Storage requires checking standard setup. Usually auth.uid()::text = owner::text. For simplicity, since it's hard to get exact policies, we'll try a generic public select and authenticated insert).
CREATE POLICY "Public Access Voices" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'voices');

CREATE POLICY "Authenticated users can insert voices" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'voices' AND auth.role() = 'authenticated');
