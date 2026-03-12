const { createClient } = require("@supabase/supabase-js");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    const { data } = await admin.from("video_generations")
        .select("video_url, prompt, created_at")
        .like("prompt", "[Voice Replace]%")
        .order("created_at", { ascending: false })
        .limit(3);

    console.log(data);
}

test();
