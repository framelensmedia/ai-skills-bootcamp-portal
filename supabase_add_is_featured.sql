-- Add is_featured column to bootcamps table
ALTER TABLE bootcamps ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Migrate existing basic_training bootcamps to be featured
UPDATE bootcamps 
SET is_featured = true 
WHERE bootcamp_type = 'basic_training';

-- (Optional) If you want to ensure only one is featured, we can handle that in UI or trigger, 
-- but for now allowing multiple is distinct from "Basic Training" which seemed singular.
-- The UI currently finds the *active* one among the list.

-- Policy updates if needed (existing policies likely cover it)
