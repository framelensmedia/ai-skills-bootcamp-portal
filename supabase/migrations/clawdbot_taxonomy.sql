-- ============================================================
-- ClawdBot Taxonomy Migration
-- Run this in Supabase SQL Editor before deploying the API
-- ============================================================

-- 1. Tags table (canonical tag list)
CREATE TABLE IF NOT EXISTS pack_tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,   -- e.g. "Facebook Ads"
    slug        TEXT NOT NULL UNIQUE,   -- e.g. "facebook-ads"
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Pack ↔ Tag mapping (many-to-many)
CREATE TABLE IF NOT EXISTS pack_tag_map (
    pack_id     UUID NOT NULL REFERENCES template_packs(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES pack_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (pack_id, tag_id)
);

-- 3. Optional: add difficulty + SEO columns to template_packs if not present
ALTER TABLE template_packs
    ADD COLUMN IF NOT EXISTS difficulty      TEXT,         -- "Beginner" | "Intermediate" | "Advanced"
    ADD COLUMN IF NOT EXISTS seo_title       TEXT,
    ADD COLUMN IF NOT EXISTS seo_description TEXT;

-- 4. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pack_tag_map_pack_id ON pack_tag_map(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_tag_map_tag_id  ON pack_tag_map(tag_id);
CREATE INDEX IF NOT EXISTS idx_pack_tags_slug        ON pack_tags(slug);

-- 5. RLS: Allow service role full access (ClawdBot uses service role key)
ALTER TABLE pack_tags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_tag_map ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default — no extra policy needed.
-- If you want public read access for the frontend filter UI:
CREATE POLICY "Public read pack_tags"    ON pack_tags    FOR SELECT USING (true);
CREATE POLICY "Public read pack_tag_map" ON pack_tag_map FOR SELECT USING (true);
