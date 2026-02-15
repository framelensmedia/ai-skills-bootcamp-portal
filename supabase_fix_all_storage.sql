-- Create ALL potential buckets to ensure no "bucket not found" errors
-- Buckets: generations, bootcamp-assets, avatars, workspace_assets, identities

-- 1. GENERATIONS
INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Generations" ON storage.objects;
CREATE POLICY "Public Generations" ON storage.objects FOR SELECT USING ( bucket_id = 'generations' );

DROP POLICY IF EXISTS "Auth Upload Generations" ON storage.objects;
CREATE POLICY "Auth Upload Generations" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'generations' );

DROP POLICY IF EXISTS "Auth Update Generations" ON storage.objects;
CREATE POLICY "Auth Update Generations" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'generations' );

-- 2. BOOTCAMP ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('bootcamp-assets', 'bootcamp-assets', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Bootcamp Assets" ON storage.objects;
CREATE POLICY "Public Bootcamp Assets" ON storage.objects FOR SELECT USING ( bucket_id = 'bootcamp-assets' );

DROP POLICY IF EXISTS "Auth Upload Bootcamp" ON storage.objects;
CREATE POLICY "Auth Upload Bootcamp" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'bootcamp-assets' );

-- 3. AVATARS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Avatars" ON storage.objects;
CREATE POLICY "Public Avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
CREATE POLICY "Auth Update Avatars" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' );

-- 4. WORKSPACE ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace_assets', 'workspace_assets', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Workspace" ON storage.objects;
CREATE POLICY "Public Workspace" ON storage.objects FOR SELECT USING ( bucket_id = 'workspace_assets' );

DROP POLICY IF EXISTS "Auth Upload Workspace" ON storage.objects;
CREATE POLICY "Auth Upload Workspace" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'workspace_assets' );

-- 5. IDENTITIES
INSERT INTO storage.buckets (id, name, public) VALUES ('identities', 'identities', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Identities" ON storage.objects;
CREATE POLICY "Public Identities" ON storage.objects FOR SELECT USING ( bucket_id = 'identities' );

DROP POLICY IF EXISTS "Auth Upload Identities" ON storage.objects;
CREATE POLICY "Auth Upload Identities" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'identities' );
