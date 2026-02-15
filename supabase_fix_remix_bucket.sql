-- Fix 'remix-images' bucket policies
-- This bucket is used by the client-side upload in the Remix Flow (prompts/[slug]/page.tsx)

-- 1. REMIX IMAGES
-- Ensure bucket exists (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('remix-images', 'remix-images', true) ON CONFLICT (id) DO NOTHING;

-- Allow Public Read
DROP POLICY IF EXISTS "Public Remix Images" ON storage.objects;
CREATE POLICY "Public Remix Images" ON storage.objects FOR SELECT USING ( bucket_id = 'remix-images' );

-- Allow Authenticated Uploads
DROP POLICY IF EXISTS "Auth Upload Remix Images" ON storage.objects;
CREATE POLICY "Auth Upload Remix Images" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'remix-images' );

-- Allow Authenticated Users to Update their own uploads (optional but good practice)
DROP POLICY IF EXISTS "Auth Update Remix Images" ON storage.objects;
CREATE POLICY "Auth Update Remix Images" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'remix-images' );
