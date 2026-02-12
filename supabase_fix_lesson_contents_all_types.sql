-- Fix lesson_contents type check constraint to include ALL types
-- Ensure 'text' and 'celebration' are both allowed along with 'video' and 'exercise'

ALTER TABLE public.lesson_contents 
DROP CONSTRAINT IF EXISTS lesson_contents_type_check;

ALTER TABLE public.lesson_contents 
ADD CONSTRAINT lesson_contents_type_check 
CHECK (type IN ('video', 'exercise', 'text', 'celebration'));
