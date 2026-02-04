-- Enable RLS on video_generations if not already
ALTER TABLE video_generations ENABLE ROW LEVEL SECURITY;

-- Allow Users to View Own Videos
CREATE POLICY "Users can view own videos" ON video_generations
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow Public to View Public Videos
CREATE POLICY "Public can view public videos" ON video_generations
  FOR SELECT
  USING (is_public = true);

-- Allow Users to Insert Own Videos (needed if client inserts, but we use admin API so maybe not strictly needed, but good practice)
-- Actually route uses service_role, so this is fine.

-- Also ensure Upvotes/Favorites are readable
CREATE POLICY "Public can view video upvotes" ON video_upvotes FOR SELECT USING (true);
CREATE POLICY "Public can view video favorites" ON video_favorites FOR SELECT USING (true);
