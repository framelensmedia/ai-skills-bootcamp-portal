-- Storage bucket policies for bootcamp-assets

-- Allow staff to upload files
INSERT INTO storage.buckets (id, name, public)
VALUES ('bootcamp-assets', 'bootcamp-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Staff can upload to bootcamp-assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view bootcamp-assets" ON storage.objects;
DROP POLICY IF EXISTS "Staff can update bootcamp-assets" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete from bootcamp-assets" ON storage.objects;

-- Staff can upload files
CREATE POLICY "Staff can upload to bootcamp-assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'bootcamp-assets' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Staff can update files
CREATE POLICY "Staff can update bootcamp-assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'bootcamp-assets' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Staff can delete files
CREATE POLICY "Staff can delete from bootcamp-assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'bootcamp-assets' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
  )
);

-- Anyone can view files (public bucket)
CREATE POLICY "Public can view bootcamp-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'bootcamp-assets');
