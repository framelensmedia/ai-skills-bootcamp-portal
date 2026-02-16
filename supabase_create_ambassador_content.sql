INSERT INTO bootcamps (
    id, title, slug, description, thumbnail_url, access_level, lesson_count, total_duration_minutes, is_published, created_at, updated_at
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- Valid UUID for Bootcamp
    'Ambassador Program', 
    'ambassador-program', 
    'Internal training for AI Skills Studio Ambassadors.', 
    NULL, 
    'free', 
    1, 
    5, 
    true, 
    now(), 
    now()
) ON CONFLICT (id) DO NOTHING;

-- Create the single Training Lesson
INSERT INTO lessons (
    id, bootcamp_id, title, slug, order_index, learning_objective, duration_minutes, content_type, video_url, text_content, create_action_type, create_action_payload, create_action_label, create_action_description, auto_save_output, is_published, created_at, updated_at
) VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', -- Valid UUID for Lesson
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Ambassador Training', 
    'training', 
    0, 
    'Learn how to promote AI Skills Studio and earn commissions.', 
    5, 
    'video', 
    NULL, -- We will use lesson_contents for multiple videos
    NULL, 
    'guided_remix', 
    '{}', 
    'Continue', 
    NULL, 
    false, 
    true, 
    now(), 
    now()
) ON CONFLICT (id) DO NOTHING;

-- Note: No initial lesson_contents are inserted; the user can now use the CMS (Studio) to add videos to this lesson. 
-- They just need to navigate to /dashboard/cms/bootcamps/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/lessons/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22
