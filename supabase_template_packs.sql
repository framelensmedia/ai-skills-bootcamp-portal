-- Create template_packs table
CREATE TABLE IF NOT EXISTS template_packs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  summary TEXT,
  category TEXT,
  tags TEXT[],
  featured_image_url TEXT,
  is_published BOOLEAN DEFAULT false,
  drop_announcement TEXT,
  version TEXT
);

-- Create template_pack_items table for ordering and linking
CREATE TABLE IF NOT EXISTS template_pack_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pack_id UUID NOT NULL REFERENCES template_packs(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  sort_index INTEGER DEFAULT 0,
  UNIQUE(pack_id, template_id)
);

-- Add pack_only flag to prompts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prompts' AND column_name = 'pack_only'
  ) THEN
    ALTER TABLE prompts ADD COLUMN pack_only BOOLEAN DEFAULT false;
  END IF;
END $$;
