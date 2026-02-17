-- Fix User Deletion by adding ON DELETE CASCADE to Foreign Keys
-- This script finds existing FKs to auth.users and replaces them with CASCADE/SET NULL versions.

BEGIN;

-- 1. Prompts
ALTER TABLE public.prompts
DROP CONSTRAINT IF EXISTS prompts_user_id_fkey,
ADD CONSTRAINT prompts_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- 2. Lesson Video Progress
-- 2. Lesson Video Progress (If exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_video_progress') THEN
        ALTER TABLE public.lesson_video_progress
        DROP CONSTRAINT IF EXISTS lesson_video_progress_user_id_fkey;
        
        ALTER TABLE public.lesson_video_progress
        ADD CONSTRAINT lesson_video_progress_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 3. Prompt Likes
-- 3. Prompt Likes (If exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prompt_likes') THEN
        ALTER TABLE public.prompt_likes
        DROP CONSTRAINT IF EXISTS prompt_likes_user_id_fkey;
        
        ALTER TABLE public.prompt_likes
        ADD CONSTRAINT prompt_likes_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 4. Video Generations
-- 4. Video Generations (If exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_generations') THEN
        ALTER TABLE public.video_generations
        DROP CONSTRAINT IF EXISTS video_generations_user_id_fkey;
        
        ALTER TABLE public.video_generations
        ADD CONSTRAINT video_generations_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Video Upvotes
-- 5. Video Upvotes (If exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_upvotes') THEN
        ALTER TABLE public.video_upvotes
        DROP CONSTRAINT IF EXISTS video_upvotes_user_id_fkey;
        
        ALTER TABLE public.video_upvotes
        ADD CONSTRAINT video_upvotes_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Video Favorites
-- 6. Video Favorites (If exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'video_favorites') THEN
        ALTER TABLE public.video_favorites
        DROP CONSTRAINT IF EXISTS video_favorites_user_id_fkey;
        
        ALTER TABLE public.video_favorites
        ADD CONSTRAINT video_favorites_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Blog Posts (Preserve content, remove author link)
-- 7. Blog Posts (If exists) (Preserve content, remove author link)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'blog_posts') THEN
        ALTER TABLE public.blog_posts
        DROP CONSTRAINT IF EXISTS blog_posts_author_id_fkey;
        
        ALTER TABLE public.blog_posts
        ADD CONSTRAINT blog_posts_author_id_fkey
            FOREIGN KEY (author_id)
            REFERENCES auth.users(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 8. Prompt Generations (Check if exists and needs fix)
-- Assuming "prompt_generations" has a user_id. 
-- We try to drop/add only if the column exists to be safe, but standard SQL doesn't handle "IF COLUMN EXISTS" well in ALTER.
-- So we'll assume standard naming/existence based on previous patterns.
-- If prompt_generations.user_id exists:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_generations' AND column_name = 'user_id') THEN
        ALTER TABLE public.prompt_generations
        DROP CONSTRAINT IF EXISTS prompt_generations_user_id_fkey;
        
        ALTER TABLE public.prompt_generations
        ADD CONSTRAINT prompt_generations_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES auth.users(id)
            ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
