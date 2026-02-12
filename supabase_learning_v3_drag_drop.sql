-- Update check constraint for lesson_contents type to include 'celebration'
alter table public.lesson_contents drop constraint if exists lesson_contents_type_check;

alter table public.lesson_contents add constraint lesson_contents_type_check 
    check (type in ('video', 'exercise', 'celebration'));
