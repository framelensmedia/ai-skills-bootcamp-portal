ALTER TABLE public.video_generations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;
