-- Create a storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for Storage
-- Allow public read access
CREATE POLICY "Avatar Public Read"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
-- Note: 'folder' strategy is often used (e.g., user_id/filename). 
-- For simplicity, we assume the filename includes the user ID or the user is just uploading to the root with a unique name.
-- A stronger policy would restrict the path.
CREATE POLICY "Avatar Upload"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update/delete their own files (if needed)
CREATE POLICY "Avatar Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

CREATE POLICY "Avatar Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'avatars' AND auth.uid() = owner );
