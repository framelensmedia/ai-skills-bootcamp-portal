import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function test() {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const email = `test_video+${Date.now()}@example.com`;
    const { data: userResp, error: userErr } = await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });

    if (userErr) {
        console.error("Error creating user:", userErr);
        return;
    }
    const user = userResp.user;

    const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    await authClient.auth.signInWithPassword({ email, password: 'password123' });

    // Find highest upvoted video
    const { data: vids } = await authClient.from('video_generations').select('id, user_id, is_public, upvotes_count').eq('is_public', true).order('upvotes_count', { ascending: false }).limit(5);
    if (!vids || vids.length === 0) {
        console.log("No public videos found.");
        return;
    }
    const vid = vids[0];
    console.log(`Trying to favorite video: ${vid.id}`);

    const { data: fav, error: favErr } = await authClient.from('video_favorites')
        .upsert({ user_id: user.id, video_id: vid.id }, { onConflict: "user_id, video_id", ignoreDuplicates: true })
        .select();

    if (favErr) {
        console.error("RLS ERROR CAUGHT on VIDEO UPSERT:", favErr);
    } else {
        console.log("SUCCESS! Video Upsert worked:", fav);
    }

    // Cleanup
    await supabase.auth.admin.deleteUser(user.id);
}
test();
