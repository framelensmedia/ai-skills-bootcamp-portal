-- Allow public (anon) access to view published generations in the feed

-- 1. Drop the restrictive policy that forced auth.user_id check for visibility
DROP POLICY IF EXISTS "Feed visibility" ON prompt_generations;

-- 2. Create looser policy: Anyone (anon or auth) can see public generations
--    Authenticated users can also see their own private ones.
CREATE POLICY "Feed visibility" ON prompt_generations
    FOR SELECT
    USING (
        is_public = TRUE 
        OR 
        (auth.role() = 'authenticated' AND auth.uid() = user_id)
    );

-- 3. Explicitly grant SELECT permission to anon role for public feed access
GRANT SELECT ON prompt_generations TO anon;

-- 4. Enable RLS (idempotent)
ALTER TABLE prompt_generations ENABLE ROW LEVEL SECURITY;
