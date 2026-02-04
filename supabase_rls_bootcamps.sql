-- RLS Policies for Bootcamps and Lessons
-- Run this in Supabase SQL Editor to fix permission issues

-- ============================================
-- BOOTCAMPS TABLE - RLS POLICIES
-- ============================================

-- Enable RLS on bootcamps
ALTER TABLE bootcamps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Public can view published bootcamps" ON bootcamps;
DROP POLICY IF EXISTS "Staff can view all bootcamps" ON bootcamps;
DROP POLICY IF EXISTS "Staff can insert bootcamps" ON bootcamps;
DROP POLICY IF EXISTS "Staff can update bootcamps" ON bootcamps;
DROP POLICY IF EXISTS "Staff can delete bootcamps" ON bootcamps;

-- 1. Anyone can view published bootcamps
CREATE POLICY "Public can view published bootcamps" ON bootcamps
  FOR SELECT USING (is_published = true);

-- 2. Staff can view ALL bootcamps (including drafts)
CREATE POLICY "Staff can view all bootcamps" ON bootcamps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 3. Staff can INSERT bootcamps
CREATE POLICY "Staff can insert bootcamps" ON bootcamps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 4. Staff can UPDATE bootcamps
CREATE POLICY "Staff can update bootcamps" ON bootcamps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 5. Staff can DELETE bootcamps
CREATE POLICY "Staff can delete bootcamps" ON bootcamps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- ============================================
-- LESSONS TABLE - RLS POLICIES
-- ============================================

-- Enable RLS on lessons
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public can view published lessons" ON lessons;
DROP POLICY IF EXISTS "Staff can view all lessons" ON lessons;
DROP POLICY IF EXISTS "Staff can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Staff can update lessons" ON lessons;
DROP POLICY IF EXISTS "Staff can delete lessons" ON lessons;

-- 1. Anyone can view published lessons (if their bootcamp is published)
CREATE POLICY "Public can view published lessons" ON lessons
  FOR SELECT USING (
    is_published = true 
    AND EXISTS (
      SELECT 1 FROM bootcamps 
      WHERE bootcamps.id = lessons.bootcamp_id 
      AND bootcamps.is_published = true
    )
  );

-- 2. Staff can view ALL lessons
CREATE POLICY "Staff can view all lessons" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 3. Staff can INSERT lessons
CREATE POLICY "Staff can insert lessons" ON lessons
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 4. Staff can UPDATE lessons
CREATE POLICY "Staff can update lessons" ON lessons
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- 5. Staff can DELETE lessons
CREATE POLICY "Staff can delete lessons" ON lessons
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- ============================================
-- VERIFY YOUR USER HAS STAFF ROLE
-- ============================================
-- Run this query to check your user's role:
-- SELECT user_id, role FROM profiles WHERE user_id = auth.uid();
--
-- If you need to update your role to admin, run:
-- UPDATE profiles SET role = 'admin' WHERE user_id = 'YOUR-USER-ID-HERE';
