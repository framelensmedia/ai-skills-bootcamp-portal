-- Update storage bucket configuration for bootcamp-assets to allow 50MB files
UPDATE storage.buckets
SET file_size_limit = 52428800 -- 50MB in bytes
WHERE id = 'bootcamp-assets';

-- Also ensure allowed mime types are permissive if restricted (optional)
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'bootcamp-assets';
