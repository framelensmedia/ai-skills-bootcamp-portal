-- Add thumbnail_url column to video_generations table
ALTER TABLE public.video_generations 
ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Backfill existing videos: use source image as thumbnail if available
-- First, let's update videos that have a source_image_id
UPDATE public.video_generations vg
SET thumbnail_url = pg.image_url
FROM public.prompt_generations pg
WHERE vg.source_image_id = pg.id
  AND vg.thumbnail_url IS NULL
  AND pg.image_url IS NOT NULL;
