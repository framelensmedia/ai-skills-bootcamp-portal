import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? "";
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? "";

        // Verify secret token to prevent unauthorized execution (CRON only)
        // If triggered via HTTP, you'd check a bearer token. For local testing, we might bypass.
        const authHeader = req.headers.get('Authorization');
        if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET')}` && Deno.env.get('ENVIRONMENT') !== 'local') {
            // Let's rely on standard Supabase JWT for anon if needed, or enforce a custom CRON_SECRET
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // 1. Fetch posts scheduled for NOW or earlier that are still 'scheduled'
        const now = new Date().toISOString();
        const { data: posts, error: fetchErr } = await supabase
            .from('scheduled_posts')
            .select('*')
            .eq('status', 'scheduled')
            .lte('scheduled_for', now)
            .limit(20); // Batch size

        if (fetchErr) throw fetchErr;

        if (!posts || posts.length === 0) {
            return new Response(JSON.stringify({ message: "No posts scheduled for now." }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        console.log(`Processing ${posts.length} scheduled posts...`);

        const results = [];

        // 2. Process each post
        for (const post of posts) {
            try {
                // Mark as publishing to prevent duplicate processing if another worker fires
                await supabase.from('scheduled_posts').update({ status: 'publishing' }).eq('id', post.id);

                // Fetch the user's connected social accounts for the designated platforms
                const { data: accounts, error: accErr } = await supabase
                    .from('social_accounts')
                    .select('*')
                    .eq('user_id', post.user_id)
                    .in('platform', post.platforms || []);

                if (accErr || !accounts || accounts.length === 0) {
                    throw new Error("No connected accounts found for the requested platforms.");
                }

                const postResults = [];
                const postErrors = [];

                // Platform Execution
                for (const account of accounts) {
                    try {
                        if (account.platform === "instagram") {
                            const res = await publishToInstagram(account.account_id, account.access_token, post.asset_url, post.caption, "image"); // Defaulting to image logic for MVP, requires mediaType column in future
                            postResults.push({ platform: "instagram", data: res });
                        } else if (account.platform === "facebook") {
                            const res = await publishToFacebookPage(account.account_id, account.access_token, post.asset_url, post.caption, "image");
                            postResults.push({ platform: "facebook", data: res });
                        } else if (account.platform === "tiktok") {
                            const res = await publishToTikTok(account.access_token, post.asset_url, post.caption);
                            postResults.push({ platform: "tiktok", data: res });
                        }
                    } catch (err) {
                        console.error(`Error on ${account.platform} for Post ${post.id}:`, err);
                        postErrors.push({ platform: account.platform, error: err.message });
                    }
                }

                const overallStatus = postErrors.length === 0 ? 'posted' : (postResults.length > 0 ? 'posted' : 'failed');

                // Update Post Status
                await supabase.from('scheduled_posts').update({
                    status: overallStatus,
                    platform_responses: { results: postResults, errors: postErrors },
                    updated_at: new Date().toISOString()
                }).eq('id', post.id);

                results.push({ id: post.id, status: overallStatus });

            } catch (err) {
                console.error(`Critical error processing post ${post.id}:`, err);
                await supabase.from('scheduled_posts').update({
                    status: 'failed',
                    platform_responses: { error: err.message },
                    updated_at: new Date().toISOString()
                }).eq('id', post.id);
            }
        }

        return new Response(JSON.stringify({ message: "Processed batch", results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
});


// ---- PLATFORM HELPERS (Deno Context) ----

async function publishToInstagram(igUserId: string, token: string, mediaUrl: string, caption: string, mediaType: "image" | "video") {
    // Determine media type heuristically if not passed strongly
    const isVideo = mediaUrl.includes(".mp4");

    let createContainerUrl = `https://graph.facebook.com/v19.0/${igUserId}/media?access_token=${token}&caption=${encodeURIComponent(caption || '')}`;

    if (isVideo) {
        createContainerUrl += `&media_type=REELS&video_url=${encodeURIComponent(mediaUrl)}`;
    } else {
        createContainerUrl += `&image_url=${encodeURIComponent(mediaUrl)}`;
    }

    const containerRes = await fetch(createContainerUrl, { method: "POST" });
    const containerData = await containerRes.json();

    if (containerData.error) throw new Error(containerData.error.message);

    const creationId = containerData.id;

    if (isVideo) {
        await new Promise(r => setTimeout(r, 6000));
    }

    const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish?creation_id=${creationId}&access_token=${token}`;
    const publishRes = await fetch(publishUrl, { method: "POST" });
    const publishData = await publishRes.json();

    if (publishData.error) throw new Error(publishData.error.message);

    return publishData;
}

async function publishToFacebookPage(pageId: string, token: string, mediaUrl: string, caption: string, mediaType: "image" | "video") {
    const isVideo = mediaUrl.includes(".mp4");
    const endpoint = isVideo ? "videos" : "photos";
    const mediaParam = isVideo ? "file_url" : "url";

    let qs = `access_token=${token}&${mediaParam}=${encodeURIComponent(mediaUrl)}`;

    if (caption) {
        if (isVideo) qs += `&description=${encodeURIComponent(caption)}`;
        else qs += `&message=${encodeURIComponent(caption)}`;
    }

    const postUrl = `https://graph.facebook.com/v19.0/${pageId}/${endpoint}?${qs}`;
    const res = await fetch(postUrl, { method: "POST" });
    const data = await res.json();

    if (data.error) throw new Error(data.error.message);

    return data;
}

async function publishToTikTok(token: string, mediaUrl: string, caption: string) {
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) throw new Error("Failed to download video for TikTok.");
    const videoBlob = await videoRes.blob();
    const videoSize = videoBlob.size;

    const initUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    const initRes = await fetch(initUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
            post_info: { title: caption || '', privacy_level: "PUBLIC_TO_EVERYONE", disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
            source_info: { source: "FILE_UPLOAD", video_size: videoSize, chunk_size: videoSize, total_chunk_count: 1 }
        })
    });

    const initData = await initRes.json();
    if (initData.error && initData.error.code !== "ok") throw new Error(initData.error.message);

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`, "Content-Type": "video/mp4" },
        body: videoBlob
    });

    if (!uploadRes.ok) throw new Error(`TikTok Video Upload chunks failed.`);

    return { publish_id: publishId };
}
