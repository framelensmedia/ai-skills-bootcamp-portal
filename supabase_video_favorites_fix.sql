-- Add folder_id to video_favorites
ALTER TABLE public.video_favorites 
ADD COLUMN IF NOT EXISTS folder_id uuid references public.folders(id) on delete set null;
