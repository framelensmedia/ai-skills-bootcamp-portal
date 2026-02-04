-- RLS Policies for template_packs table

-- Enable RLS (if not already enabled)
ALTER TABLE template_packs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Staff can insert template packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can update template packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can delete template packs" ON template_packs;
DROP POLICY IF EXISTS "Public can view published packs" ON template_packs;
DROP POLICY IF EXISTS "Staff can view all packs" ON template_packs;

-- Staff can insert packs
CREATE POLICY "Staff can insert template packs" ON template_packs
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can update packs
CREATE POLICY "Staff can update template packs" ON template_packs
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can delete packs
CREATE POLICY "Staff can delete template packs" ON template_packs
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can view all packs
CREATE POLICY "Staff can view all packs" ON template_packs
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Public can view published packs (optional, for future use)
CREATE POLICY "Public can view published packs" ON template_packs
  FOR SELECT 
  USING (true);
  -- You can restrict this later with a condition like: is_published = true


-- Similarly, add RLS policies for template_pack_items
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
