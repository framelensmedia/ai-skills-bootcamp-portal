-- Create 'generations' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('generations', 'generations', true)
ON CONFLICT (id) DO NOTHING;

-- RLS is enabled by default on storage.objects in Supabase
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow Public Access to Downloads
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'generations' );

-- Allow Authenticated Users to Upload
CREATE POLICY "Authenticated Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'generations' );

-- Allow Users to Update their own files
CREATE POLICY "User Updates"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'generations' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'generations' AND auth.uid() = owner );

-- Allow Users to Delete their own files
CREATE POLICY "User Deletes"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'generations' AND auth.uid() = owner );
