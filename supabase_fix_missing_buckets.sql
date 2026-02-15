-- Create missing buckets: workspace_assets, identities
-- These were found to be missing during verification.

-- 1. WORKSPACE ASSETS
INSERT INTO storage.buckets (id, name, public) VALUES ('workspace_assets', 'workspace_assets', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Workspace" ON storage.objects;
CREATE POLICY "Public Workspace" ON storage.objects FOR SELECT USING ( bucket_id = 'workspace_assets' );

DROP POLICY IF EXISTS "Auth Upload Workspace" ON storage.objects;
CREATE POLICY "Auth Upload Workspace" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'workspace_assets' );

-- 2. IDENTITIES
INSERT INTO storage.buckets (id, name, public) VALUES ('identities', 'identities', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Identities" ON storage.objects;
CREATE POLICY "Public Identities" ON storage.objects FOR SELECT USING ( bucket_id = 'identities' );

DROP POLICY IF EXISTS "Auth Upload Identities" ON storage.objects;
CREATE POLICY "Auth Upload Identities" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'identities' );
