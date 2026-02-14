ALTER TABLE user_identities 
ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'My Identity';

-- Update existing rows if any
UPDATE user_identities SET name = 'My Identity' WHERE name IS NULL;
