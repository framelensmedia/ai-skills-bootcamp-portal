-- Add bootcamp_type column for identifying Basic Training bootcamps
-- Run this in Supabase SQL Editor

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bootcamps' AND column_name = 'bootcamp_type'
  ) THEN
    ALTER TABLE bootcamps ADD COLUMN bootcamp_type TEXT DEFAULT 'standard' 
      CHECK (bootcamp_type IN ('standard', 'basic_training', 'advanced', 'workshop'));
  END IF;
END $$;

-- Create index for basic_training queries
CREATE INDEX IF NOT EXISTS idx_bootcamps_type ON bootcamps(bootcamp_type) WHERE bootcamp_type = 'basic_training';
