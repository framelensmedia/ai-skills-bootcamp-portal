
ALTER TABLE prompt_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can delete own generations" ON prompt_generations FOR DELETE USING (auth.uid() = user_id);

