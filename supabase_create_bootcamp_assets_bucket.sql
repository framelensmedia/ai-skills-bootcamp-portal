-- Create 'bootcamp-assets' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('bootcamp-assets', 'bootcamp-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS is enabled by default on storage.objects in Supabase
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow Public Access to Downloads
CREATE POLICY "Public Access Bootcamp Assets"
ON storage.objects FOR SELECT
USING ( bucket_id = 'bootcamp-assets' );

-- Allow Authenticated Users to Upload
CREATE POLICY "Authenticated Uploads Bootcamp Assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'bootcamp-assets' );

-- Allow Users to Update their own files
CREATE POLICY "User Updates Bootcamp Assets"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'bootcamp-assets' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'bootcamp-assets' AND auth.uid() = owner );

-- Allow Users to Delete their own files
CREATE POLICY "User Deletes Bootcamp Assets"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'bootcamp-assets' AND auth.uid() = owner );
