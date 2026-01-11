-- Create storage bucket for bootcamp assets (thumbnails, etc.)
-- Run this in Supabase SQL Editor

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bootcamp-assets',
  'bootcamp-assets', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- RLS Policies for the bucket

-- Anyone can view (public bucket)
CREATE POLICY "Public can view bootcamp assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'bootcamp-assets');

-- Staff can upload
CREATE POLICY "Staff can upload bootcamp assets" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'bootcamp-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- Staff can update
CREATE POLICY "Staff can update bootcamp assets" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'bootcamp-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- Staff can delete
CREATE POLICY "Staff can delete bootcamp assets" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'bootcamp-assets'
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );
