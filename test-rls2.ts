import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function test() {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const email = `test_again+${Date.now()}@example.com`;
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
    console.log("Created test user:", user.id);

    const authClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: session, error: signinErr } = await authClient.auth.signInWithPassword({
        email,
        password: 'password123'
    });

    if (signinErr) {
        console.error("Error signing in:", signinErr);
        return;
    }
    console.log("Signed in.");

    // Find highest upvoted generation (like the screenshot)
    const { data: gens } = await authClient.from('prompt_generations').select('id, user_id, is_public, upvotes_count').eq('is_public', true).order('upvotes_count', { ascending: false }).limit(5);
    if (!gens || gens.length === 0) {
        console.log("No public generations found.");
        return;
    }
    const gen = gens[0];
    console.log(`Trying to favorite public generation: ${gen.id} (user: ${gen.user_id}, upvotes: ${gen.upvotes_count})`);

    // INSTEAD OF INSERT, THE UI USES UPSERT:
    console.log("Attempting upsert (like the frontend FeedClient)...");
    const { data: fav, error: favErr } = await authClient.from('prompt_favorites')
        .upsert({ user_id: user.id, generation_id: gen.id }, { onConflict: "user_id, generation_id", ignoreDuplicates: true })
        .select();

    if (favErr) {
        console.error("RLS ERROR CAUGHT on UPSERT:", favErr);
    } else {
        console.log("SUCCESS! Upsert worked:", fav);
    }

    // Also try upvote upsert like RemixCard
    console.log("Attempting upvote upsert...");
    const { data: upv, error: upvErr } = await authClient.from('remix_upvotes')
        .upsert({ user_id: user.id, generation_id: gen.id }, { onConflict: "user_id, generation_id", ignoreDuplicates: true })
        .select();

    if (upvErr) {
        console.error("RLS ERROR CAUGHT on UPVOTE UPSERT:", upvErr);
    } else {
        console.log("SUCCESS! Upvote Upsert worked:", upv);
    }

    // Cleanup
    await supabase.auth.admin.deleteUser(user.id);
    console.log("Deleted test user.");
}
test();
