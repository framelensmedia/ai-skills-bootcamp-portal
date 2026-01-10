-- Force the avatars bucket to be public
UPDATE storage.buckets
SET public = true
WHERE id = 'avatars';

-- Ensure the bucket exists if it didn't (just in case)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Re-apply policies to be safe
DROP POLICY IF EXISTS "Avatar Public Read" ON storage.objects;
CREATE POLICY "Avatar Public Read" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Avatar Upload" ON storage.objects;
CREATE POLICY "Avatar Upload" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- Allow users to update their own files (overwrite)
DROP POLICY IF EXISTS "Avatar Update" ON storage.objects;
CREATE POLICY "Avatar Update" ON storage.objects FOR UPDATE USING ( bucket_id = 'avatars' AND auth.uid() = owner ) WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );
