-- Create prompt_images bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('remix-images', 'remix-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Policies for remix-images
DROP POLICY IF EXISTS "Public Select Remix Images" ON storage.objects;
CREATE POLICY "Public Select Remix Images" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'remix-images' );

DROP POLICY IF EXISTS "Authenticated Insert Remix Images" ON storage.objects;
CREATE POLICY "Authenticated Insert Remix Images" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'remix-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Users Update Own Remix Images" ON storage.objects;
CREATE POLICY "Users Update Own Remix Images" 
ON storage.objects FOR UPDATE 
USING ( bucket_id = 'remix-images' AND auth.uid() = owner );

DROP POLICY IF EXISTS "Users Delete Own Remix Images" ON storage.objects;
CREATE POLICY "Users Delete Own Remix Images" 
ON storage.objects FOR DELETE 
USING ( bucket_id = 'remix-images' AND auth.uid() = owner );
