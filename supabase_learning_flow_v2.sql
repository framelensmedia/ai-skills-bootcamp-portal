-- Learning Flow™ v2 Schema Updates
-- Run this AFTER the initial learning_flow.sql migration

-- ============================================
-- 1) LESSON VIDEOS TABLE (Multi-video support)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER DEFAULT 60,
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_videos_lesson ON lesson_videos(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_videos_order ON lesson_videos(lesson_id, order_index);

-- RLS for lesson_videos
ALTER TABLE lesson_videos ENABLE ROW LEVEL SECURITY;

-- Anyone can view videos for published lessons
CREATE POLICY "Public can view lesson videos" ON lesson_videos FOR SELECT
  USING (
    is_published = true 
    AND EXISTS (
      SELECT 1 FROM lessons 
      WHERE lessons.id = lesson_videos.lesson_id 
      AND lessons.is_published = true
    )
  );

-- Staff can manage lesson videos
CREATE POLICY "Staff can manage lesson videos" ON lesson_videos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('staff', 'instructor', 'editor', 'admin', 'super_admin')
    )
  );

-- ============================================
-- 2) TEMPLATE VISIBILITY (Add to prompts table)
-- ============================================
-- Note: prompts_public is a VIEW, so we only add to the base prompts table
-- The view will automatically include the new column if it selects *

DO $$ 
BEGIN
  -- Add visibility column to prompts table if it doesn't exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompts' AND table_type = 'BASE TABLE') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'prompts' AND column_name = 'visibility'
    ) THEN
      ALTER TABLE prompts ADD COLUMN visibility TEXT DEFAULT 'public' 
        CHECK (visibility IN ('public', 'learning_only', 'staff_only'));
    END IF;
  END IF;
END $$;

-- Create index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_prompts_visibility ON prompts(visibility) WHERE visibility = 'public';

-- ============================================
-- 3) MISSION EVENTS TABLE (For automation)
-- ============================================
CREATE TABLE IF NOT EXISTS mission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'mission_started',
    'mission_completed', 
    'mission_skipped',
    'bootcamp_started',
    'bootcamp_completed',
    'mission_incomplete_24h',
    'user_inactive_24h'
  )),
  payload JSONB DEFAULT '{}',
  -- Context
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  bootcamp_id UUID REFERENCES bootcamps(id) ON DELETE SET NULL,
  generation_id UUID,
  -- Webhook status
  webhook_sent BOOLEAN DEFAULT false,
  webhook_sent_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_events_user ON mission_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mission_events_type ON mission_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mission_events_created ON mission_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_events_webhook ON mission_events(webhook_sent) WHERE webhook_sent = false;

-- RLS for mission_events
ALTER TABLE mission_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view own events" ON mission_events FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own events
CREATE POLICY "Users can insert own events" ON mission_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Staff can view all events
CREATE POLICY "Staff can view all events" ON mission_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 4) UPDATE LESSONS TABLE (Add video_count cache)
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lessons' AND column_name = 'video_count'
  ) THEN
    ALTER TABLE lessons ADD COLUMN video_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Function to update video count
CREATE OR REPLACE FUNCTION update_lesson_video_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lessons SET
    video_count = (
      SELECT COUNT(*) FROM lesson_videos 
      WHERE lesson_id = COALESCE(NEW.lesson_id, OLD.lesson_id) 
      AND is_published = true
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.lesson_id, OLD.lesson_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for video count
DROP TRIGGER IF EXISTS trigger_update_lesson_video_count ON lesson_videos;
CREATE TRIGGER trigger_update_lesson_video_count
AFTER INSERT OR UPDATE OR DELETE ON lesson_videos
FOR EACH ROW EXECUTE FUNCTION update_lesson_video_count();

-- ============================================
-- 5) ADD started_at TO lesson_progress IF MISSING
-- ============================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lesson_progress' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE lesson_progress ADD COLUMN started_at TIMESTAMPTZ;
  END IF;
END $$;
