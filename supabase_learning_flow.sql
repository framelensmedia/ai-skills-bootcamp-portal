-- Learning Flow™ Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- BOOTCAMPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS bootcamps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  access_level TEXT DEFAULT 'free' CHECK (access_level IN ('free', 'premium')),
  lesson_count INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LESSONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bootcamp_id UUID REFERENCES bootcamps(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  
  -- Learning Objective (shown to user)
  learning_objective TEXT,
  duration_minutes INTEGER DEFAULT 5 CHECK (duration_minutes <= 10),
  
  -- Content (video OR text)
  content_type TEXT DEFAULT 'video' CHECK (content_type IN ('video', 'text', 'both')),
  video_url TEXT,
  text_content TEXT,
  
  -- Create Action (required for Learning Flow)
  create_action_type TEXT NOT NULL CHECK (create_action_type IN ('prompt_template', 'template_pack', 'guided_remix')),
  create_action_payload JSONB NOT NULL DEFAULT '{}',
  -- Example payloads:
  -- { "template_id": "uuid" }
  -- { "template_ids": ["uuid1", "uuid2"] }
  -- { "pack_id": "uuid" }
  
  create_action_label TEXT DEFAULT 'Create Now',
  create_action_description TEXT,
  
  auto_save_output BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(bootcamp_id, slug),
  UNIQUE(bootcamp_id, order_index)
);

-- ============================================
-- USER LESSON PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  bootcamp_id UUID REFERENCES bootcamps(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped')),
  generation_id UUID, -- Reference to created asset (prompt_generations.id)
  
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, lesson_id)
);

-- ============================================
-- USER BOOTCAMP PROGRESS (Aggregate)
-- ============================================
CREATE TABLE IF NOT EXISTS bootcamp_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bootcamp_id UUID REFERENCES bootcamps(id) ON DELETE CASCADE,
  
  current_lesson_index INTEGER DEFAULT 0,
  lessons_completed INTEGER DEFAULT 0,
  lessons_skipped INTEGER DEFAULT 0,
  
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, bootcamp_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_bootcamp ON lessons(bootcamp_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(bootcamp_id, order_index);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_bootcamp_progress_user ON bootcamp_progress(user_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Bootcamps: Anyone can read published, owners can manage
ALTER TABLE bootcamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published bootcamps are viewable by everyone"
  ON bootcamps FOR SELECT
  USING (is_published = true);

CREATE POLICY "Staff can manage bootcamps"
  ON bootcamps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- Lessons: Anyone can read published lessons of published bootcamps
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published lessons are viewable"
  ON lessons FOR SELECT
  USING (
    is_published = true 
    AND EXISTS (
      SELECT 1 FROM bootcamps WHERE bootcamps.id = lessons.bootcamp_id AND bootcamps.is_published = true
    )
  );

CREATE POLICY "Staff can manage lessons"
  ON lessons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- Lesson Progress: Users can only see/modify their own
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lesson progress"
  ON lesson_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own lesson progress"
  ON lesson_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own lesson progress"
  ON lesson_progress FOR UPDATE
  USING (user_id = auth.uid());

-- Bootcamp Progress: Users can only see/modify their own
ALTER TABLE bootcamp_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bootcamp progress"
  ON bootcamp_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own bootcamp progress"
  ON bootcamp_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own bootcamp progress"
  ON bootcamp_progress FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTION: Update bootcamp stats
-- ============================================
CREATE OR REPLACE FUNCTION update_bootcamp_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bootcamps SET
    lesson_count = (SELECT COUNT(*) FROM lessons WHERE bootcamp_id = NEW.bootcamp_id AND is_published = true),
    total_duration_minutes = (SELECT COALESCE(SUM(duration_minutes), 0) FROM lessons WHERE bootcamp_id = NEW.bootcamp_id AND is_published = true),
    updated_at = now()
  WHERE id = NEW.bootcamp_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bootcamp_stats
AFTER INSERT OR UPDATE OR DELETE ON lessons
FOR EACH ROW EXECUTE FUNCTION update_bootcamp_stats();

-- ============================================
-- SEED DATA (Example Bootcamp)
-- ============================================
-- Uncomment to add a sample bootcamp for testing

-- INSERT INTO bootcamps (title, slug, description, access_level, is_published) VALUES
-- ('AI Content Mastery', 'ai-content-mastery', 'Learn to create professional content with AI in under 30 minutes.', 'free', true);

-- INSERT INTO lessons (bootcamp_id, title, slug, order_index, learning_objective, duration_minutes, content_type, video_url, create_action_type, create_action_payload, create_action_label, is_published)
-- SELECT 
--   id,
--   'Create Your First AI Image',
--   'first-ai-image',
--   0,
--   'Create a professional-quality AI image for your brand',
--   4,
--   'video',
--   'https://example.com/video1.mp4',
--   'prompt_template',
--   '{"template_id": "your-template-uuid-here"}',
--   'Create Your Image',
--   true
-- FROM bootcamps WHERE slug = 'ai-content-mastery';
