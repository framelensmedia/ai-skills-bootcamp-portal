
DO $$
BEGIN
    -- Verify column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_generations' AND column_name = 'folder_id') THEN
        RAISE EXCEPTION 'Column folder_id missing in prompt_generations';
    END IF;
END
$$;

-- Ensure RLS allows UPDATE for owner
DROP POLICY IF EXISTS "Users can update their own generations" ON prompt_generations;
CREATE POLICY "Users can update their own generations" ON prompt_generations
    FOR UPDATE USING (auth.uid() = user_id);

