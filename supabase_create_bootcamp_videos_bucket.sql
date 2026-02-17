-- Create 'bootcamp-videos' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('bootcamp-videos', 'bootcamp-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow Public Access to Downloads
CREATE POLICY "Public Access Bootcamp Videos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'bootcamp-videos' );

-- Allow Authenticated Users to Upload
CREATE POLICY "Authenticated Uploads Bootcamp Videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'bootcamp-videos' );

-- Allow Users to Update their own files
CREATE POLICY "User Updates Bootcamp Videos"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'bootcamp-videos' AND auth.uid() = owner )
WITH CHECK ( bucket_id = 'bootcamp-videos' AND auth.uid() = owner );

-- Allow Users to Delete their own files
CREATE POLICY "User Deletes Bootcamp Videos"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'bootcamp-videos' AND auth.uid() = owner );
