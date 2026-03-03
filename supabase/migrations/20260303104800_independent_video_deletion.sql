-- SQL script to add ON DELETE SET NULL to video_generations.source_image_id foreign key

-- Start a transaction safely
BEGIN;

-- Drop the existing foreign key constraint
ALTER TABLE "public"."video_generations"
DROP CONSTRAINT IF EXISTS "video_generations_source_image_id_fkey";

-- Add the foreign key constraint back with ON DELETE SET NULL
ALTER TABLE "public"."video_generations"
ADD CONSTRAINT "video_generations_source_image_id_fkey"
FOREIGN KEY ("source_image_id")
REFERENCES "public"."prompt_generations"("id")
ON DELETE SET NULL;

COMMIT;
