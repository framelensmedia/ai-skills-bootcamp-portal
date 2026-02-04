-- Complete Template Packs Setup
-- Run this entire file in Supabase SQL Editor

-- 1. Create template_pack_items table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS template_pack_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  pack_id UUID NOT NULL REFERENCES template_packs(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  sort_index INTEGER DEFAULT 0,
  UNIQUE(pack_id, template_id)
);

-- 2. Add pack_only flag to prompts table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'prompts' AND column_name = 'pack_only'
  ) THEN
    ALTER TABLE prompts ADD COLUMN pack_only BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 3. Add missing columns to prompts table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'style_mode') THEN
    ALTER TABLE prompts ADD COLUMN style_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'edit_mode') THEN
    ALTER TABLE prompts ADD COLUMN edit_mode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'required_elements') THEN
    ALTER TABLE prompts ADD COLUMN required_elements TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'aspect_ratios') THEN
    ALTER TABLE prompts ADD COLUMN aspect_ratios TEXT[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'template_id') THEN
    ALTER TABLE prompts ADD COLUMN template_id TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompts' AND column_name = 'template_pack_id') THEN
    ALTER TABLE prompts ADD COLUMN template_pack_id UUID REFERENCES template_packs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_pack_items_pack_id ON template_pack_items(pack_id);
CREATE INDEX IF NOT EXISTS idx_template_pack_items_template_id ON template_pack_items(template_id);
CREATE INDEX IF NOT EXISTS idx_prompts_pack_only ON prompts(pack_only) WHERE pack_only = true;
CREATE INDEX IF NOT EXISTS idx_prompts_template_pack_id ON prompts(template_pack_id) WHERE template_pack_id IS NOT NULL;

-- 5. RLS Policies for template_packs
ALTER TABLE template_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can insert template packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can update template packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can delete template packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can view all packs" ON template_packs;
DROP POLICY IF EXISTS "Public can view published packs" ON template_packs;

CREATE POLICY "Staff can insert template packs" ON template_packs
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "Staff can update template packs" ON template_packs
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "Staff can delete template packs" ON template_packs
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "Staff can view all packs" ON template_packs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "Public can view published packs" ON template_packs
  FOR SELECT 
  USING (true);

-- 6. RLS Policies for template_pack_items
ALTER TABLE template_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage pack items" ON template_pack_items;
DROP POLICY IF EXISTS "Anyone can view pack items" ON template_pack_items;

CREATE POLICY "Staff can manage pack items" ON template_pack_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

CREATE POLICY "Anyone can view pack items" ON template_pack_items
  FOR SELECT 
  USING (true);
