-- Create ALL potential buckets to ensure no "bucket not found" errors
-- Buckets: generations, bootcamp-assets, avatars, workspace_assets, identities

-- 1. GENERATIONS
INSERT INTO storage.buckets (id, name, public) VALUES ('generations', 'generations', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Generatons" ON storage.objects FOR SELECT USING ( bucket_id = 'generations' );
CREATE POLICY "Auth Upload Generations" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'generations' );
CREATE POLICY "Auth Update Generations" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'generations' );

-- 2. BOOTCAMP ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('bootcamp-assets', 'bootcamp-assets', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Bootcamp Assets" ON storage.objects FOR SELECT USING ( bucket_id = 'bootcamp-assets' );
CREATE POLICY "Auth Upload Bootcamp" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'bootcamp-assets' );

-- 3. AVATARS
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Avatars" ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );
CREATE POLICY "Auth Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );
CREATE POLICY "Auth Update Avatars" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' );

-- 4. WORKSPACE ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace_assets', 'workspace_assets', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Workspace" ON storage.objects FOR SELECT USING ( bucket_id = 'workspace_assets' );
CREATE POLICY "Auth Upload Workspace" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'workspace_assets' );

-- 5. IDENTITIES
INSERT INTO storage.buckets (id, name, public) VALUES ('identities', 'identities', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Public Identities" ON storage.objects FOR SELECT USING ( bucket_id = 'identities' );
CREATE POLICY "Auth Upload Identities" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'identities' );
