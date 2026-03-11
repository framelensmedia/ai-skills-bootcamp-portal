-- Migration: Music Generations & Storage
-- Description: Creates a table to store generated music tracks and a storage bucket for the audio files.

-- 1. Create table for music generations
CREATE TABLE IF NOT EXISTS public.music_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    duration_seconds NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS for table
ALTER TABLE public.music_generations ENABLE ROW LEVEL SECURITY;

-- Policies for table
CREATE POLICY "Users can view their own music generations" 
ON public.music_generations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own music generations" 
ON public.music_generations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music generations" 
ON public.music_generations FOR DELETE 
USING (auth.uid() = user_id);

-- 2. Create storage bucket for music
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music', 'music', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for bucket
-- Allow public read access
CREATE POLICY "Public Access to music" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'music');

-- Allow authenticated users to insert files into their own folder (e.g. "user_id/filename.mp3")
CREATE POLICY "Users can upload their own music" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'music' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own music" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
    bucket_id = 'music' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own music" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
    bucket_id = 'music' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
