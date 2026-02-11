-- AI Skills Studio Notebook & Strategist Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1) NOTEBOOK FOLDERS
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  parent_id UUID REFERENCES notebook_folders(id) ON DELETE CASCADE, -- Supports nesting
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notebook_folders_user ON notebook_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_folders_parent ON notebook_folders(parent_id);

-- RLS
ALTER TABLE notebook_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own folders" ON notebook_folders
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 2) NOTEBOOK NOTES
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  folder_id UUID REFERENCES notebook_folders(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Note',
  content TEXT DEFAULT '', -- Markdown content
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notebook_notes_user ON notebook_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_notes_folder ON notebook_notes(folder_id);

-- RLS
ALTER TABLE notebook_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notes" ON notebook_notes
  FOR ALL USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notebook_notes_updated_at
    BEFORE UPDATE ON notebook_notes
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- ============================================
-- 3) NOTEBOOK CHATS (Strategist Sessions)
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  folder_id UUID REFERENCES notebook_folders(id) ON DELETE SET NULL, -- Context
  title TEXT NOT NULL DEFAULT 'New Strategy Session',
  summary TEXT, -- AI-generated summary of the strategy
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notebook_chats_user ON notebook_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_chats_folder ON notebook_chats(folder_id);

-- RLS
ALTER TABLE notebook_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chats" ON notebook_chats
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 4) NOTEBOOK CHAT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS notebook_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES notebook_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}', -- Store suggested actions, references, etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notebook_messages_chat ON notebook_chat_messages(chat_id);

-- RLS
ALTER TABLE notebook_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy depends on the parent chat ownership
CREATE POLICY "Users can manage messages in their chats" ON notebook_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM notebook_chats
      WHERE notebook_chats.id = notebook_chat_messages.chat_id
      AND notebook_chats.user_id = auth.uid()
    )
  );

-- ============================================
-- 5) HELPER FUNCTION: Get Folder Hierarchy
-- ============================================
-- Optional: recursive query to get folder tree logic if needed on client
-- For MVP, simple fetch and client-side tree construction is fine.
