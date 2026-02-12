-- Update lesson_contents type check to include 'text'
-- 'exercise' is already there, we will reuse it for 'Action' or 'Quiz'
-- We also need to ensuring 'celebration' is there (it was added in prev script but good to be safe)

ALTER TABLE public.lesson_contents 
DROP CONSTRAINT IF EXISTS lesson_contents_type_check;

ALTER TABLE public.lesson_contents
ADD CONSTRAINT lesson_contents_type_check 
CHECK (type IN ('video', 'exercise', 'celebration', 'text'));
