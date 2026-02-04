-- RLS Policies for prompts table to allow staff to view/edit drafts

-- Enable RLS if not already enabled
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict
DROP POLICY IF EXISTS "Staff can view all prompts" ON prompts;
DROP POLICY IF EXISTS "Staff can insert prompts" ON prompts;
DROP POLICY IF EXISTS "Staff can update prompts" ON prompts;
DROP POLICY IF EXISTS "Staff can delete prompts" ON prompts;
DROP POLICY IF EXISTS "Public can view published prompts" ON prompts;

-- Staff can view ALL prompts (including drafts)
CREATE POLICY "Staff can view all prompts" ON prompts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can insert prompts
CREATE POLICY "Staff can insert prompts" ON prompts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can update prompts
CREATE POLICY "Staff can update prompts" ON prompts
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Staff can delete prompts
CREATE POLICY "Staff can delete prompts" ON prompts
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'admin', 'super_admin', 'editor')
    )
  );

-- Public can view ONLY published prompts
CREATE POLICY "Public can view published prompts" ON prompts
  FOR SELECT
  USING (is_published = true);
