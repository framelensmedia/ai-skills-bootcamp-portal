-- Create table for Instructor-Led Bootcamps
CREATE TABLE IF NOT EXISTS instructor_bootcamps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    featured_image_url TEXT,
    status TEXT DEFAULT 'coming_soon', -- 'coming_soon', 'live', 'closed'
    notify_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS (safe to run multiple times)
ALTER TABLE instructor_bootcamps ENABLE ROW LEVEL SECURITY;

-- Policies (Drop first to avoid collision on re-run)
DROP POLICY IF EXISTS "Public read access" ON instructor_bootcamps;
CREATE POLICY "Public read access"
ON instructor_bootcamps FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Staff write access" ON instructor_bootcamps;
CREATE POLICY "Staff write access"
ON instructor_bootcamps FOR ALL
USING ((auth.jwt() ->> 'email') LIKE '%@taloufilms.com' OR (auth.jwt() ->> 'email') LIKE '%@admin.com')
WITH CHECK ((auth.jwt() ->> 'email') LIKE '%@taloufilms.com' OR (auth.jwt() ->> 'email') LIKE '%@admin.com');

-- Seed Data (The 3 featured bootcamps)
-- NOTE: Please update the featured_image_url with your actual Supabase Storage URLs after uploading your images.
INSERT INTO instructor_bootcamps (title, slug, description, featured_image_url)
VALUES
(
    'Start a Kids Clothing Brand with AI',
    'kids-clothing-brand',
    'Learn to design, manufacture, and market a children''s clothing line using generative AI tools.',
    '/images/bootcamps/Kids-Clothing-bootcamp.png' 
),
(
    'Start a Social Content Agency with AI',
    'social-content-agency',
    'Scale your content production and manage multiple clients effortlessly with an AI-powered workflow.',
    '/images/bootcamps/content-agency-bootcamp.png'
),
(
    'Start a YouTube Sleep Music Channel with AI',
    'youtube-sleep-music',
    'Create infinite ambient soundscapes and visuals for one of YouTube''s most popular niches.',
    '/images/bootcamps/sleep-music-bootcamp.png'
)
ON CONFLICT (slug) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    featured_image_url = EXCLUDED.featured_image_url;
