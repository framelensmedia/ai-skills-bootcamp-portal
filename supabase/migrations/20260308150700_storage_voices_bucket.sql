-- Add voices bucket for the Voice Studio clone feature
INSERT INTO storage.buckets (id, name, public) 
VALUES ('voices', 'voices', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the voices bucket

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all objects in the voices bucket
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'voices');

-- Allow authenticated users to insert files into their own folder
CREATE POLICY "Users can upload their own voices" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id = 'voices' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own voices" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
    bucket_id = 'voices' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own voices" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
    bucket_id = 'voices' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);
