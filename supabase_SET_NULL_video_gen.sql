-- SQL script to change video_generations.source_image_id to ON DELETE SET NULL
-- This allows deleting the source image without deleting the remixed video.

BEGIN;

-- Drop the cascading constraint
ALTER TABLE "public"."video_generations"
DROP CONSTRAINT IF EXISTS "video_generations_source_image_id_fkey";

-- Add the constraint back with ON DELETE SET NULL
ALTER TABLE "public"."video_generations"
ADD CONSTRAINT "video_generations_source_image_id_fkey"
FOREIGN KEY ("source_image_id")
REFERENCES "public"."prompt_generations"("id")
ON DELETE SET NULL;

COMMIT;
