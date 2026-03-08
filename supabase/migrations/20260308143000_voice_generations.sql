-- Migration: Voice Generations
-- Description: Creates a table to store generated voiceovers for the Voice Studio.

CREATE TABLE IF NOT EXISTS public.voice_generations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL, -- References the cloned voice if applicable
    voice_name TEXT, -- Store name explicitly in case the origin voice is deleted or it's a preset
    text_prompt TEXT NOT NULL,
    audio_url TEXT NOT NULL,
    duration_seconds NUMERIC(10, 2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.voice_generations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own voice generations" 
ON public.voice_generations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice generations" 
ON public.voice_generations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice generations" 
ON public.voice_generations FOR DELETE 
USING (auth.uid() = user_id);
