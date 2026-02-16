DO $$
BEGIN
    INSERT INTO bootcamps (
        id, title, slug, description, access_level, lesson_count, total_duration_minutes, is_published
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', 
        'Test Bootcamp', 
        'test-bootcamp', 
        'Test', 
        'ambassador', 
        0, 
        0, 
        false
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
END $$;
