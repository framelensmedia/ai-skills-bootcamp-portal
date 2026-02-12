-- Fix lessons content_type check constraint
-- The 'mixed' type was missing from the allowed values

ALTER TABLE public.lessons 
DROP CONSTRAINT IF EXISTS lessons_content_type_check;

ALTER TABLE public.lessons 
ADD CONSTRAINT lessons_content_type_check 
CHECK (content_type IN ('video', 'text', 'both', 'mixed'));

-- Optional: Set default to 'mixed' if appropriate for new lessons
ALTER TABLE public.lessons 
ALTER COLUMN content_type SET DEFAULT 'mixed';
