-- Create 'identities' bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('identities', 'identities', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for 'identities' bucket

-- 1. Allow public read access to all files (needed for generative AI APIs to read)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'identities' );

-- 2. Allow authenticated users to upload to their own folder (identities/{user_id}/*)
CREATE POLICY "User Upload Own Identity"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'identities' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Allow users to update their own files
CREATE POLICY "User Update Own Identity"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'identities' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Allow users to delete their own files
CREATE POLICY "User Delete Own Identity"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'identities' AND
    (storage.foldername(name))[1] = auth.uid()::text
);
