import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { assetUrl, assetId, caption, platforms, mediaType, scheduledFor } = body;

        if (!assetUrl || !platforms || platforms.length === 0) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // If it is scheduled for the future
        if (scheduledFor && new Date(scheduledFor) > new Date()) {
            await supabase.from("scheduled_posts").insert({
                user_id: user.id,
                asset_id: assetId || null,
                asset_url: assetUrl,
                caption: caption,
                platforms: platforms,
                scheduled_for: new Date(scheduledFor).toISOString(),
                status: 'scheduled',
                platform_responses: {}
            });
            return NextResponse.json({ message: "Post scheduled successfully" });
        }

        // 1. Fetch user's connected accounts
        const { data: accounts, error: accountErr } = await supabase
            .from("social_accounts")
            .select("*")
            .eq("user_id", user.id)
            .in("platform", platforms);

        if (accountErr || !accounts || accounts.length === 0) {
            return NextResponse.json({ error: "No connected accounts found for the selected platforms." }, { status: 404 });
        }

        const results: any[] = [];
        const errors: any[] = [];

        // 2. Publish to each selected platform
        for (const account of accounts) {
            try {
                if (account.platform === "instagram") {
                    const result = await publishToInstagram(account.account_id, account.access_token, assetUrl, caption, mediaType);
                    results.push({ platform: "instagram", status: "success", data: result });
                } else if (account.platform === "facebook") {
                    const result = await publishToFacebookPage(account.account_id, account.access_token, assetUrl, caption, mediaType);
                    results.push({ platform: "facebook", status: "success", data: result });
                } else if (account.platform === "tiktok") {
                    if (mediaType !== "video") {
                        throw new Error("TikTok only supports video publishing via this integration.");
                    }
                    const result = await publishToTikTok(account.access_token, assetUrl, caption);
                    results.push({ platform: "tiktok", status: "success", data: result });
                }
            } catch (err: any) {
                console.error(`Error publishing to ${account.platform}:`, err);
                errors.push({ platform: account.platform, error: err.message });
            }
        }

        // 3. Record the post in `scheduled_posts` (as 'posted' or 'failed')
        const overallStatus = errors.length === 0 ? 'posted' : (results.length > 0 ? 'posted' : 'failed');

        await supabase.from("scheduled_posts").insert({
            user_id: user.id,
            asset_id: assetId || null,
            asset_url: assetUrl,
            caption: caption,
            platforms: platforms,
            scheduled_for: new Date().toISOString(),
            status: overallStatus,
            platform_responses: { results, errors }
        });

        if (errors.length > 0 && results.length === 0) {
            // All failed
            return NextResponse.json({ error: "Failed to publish to all selected platforms.", details: errors }, { status: 500 });
        } else if (errors.length > 0) {
            // Partial success
            return NextResponse.json({ message: "Published partially.", results, errors }, { status: 207 });
        }

        // All success
        return NextResponse.json({ message: "Published successfully", results });

    } catch (e: any) {
        console.error("Publishing API Error:", e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// ---- PLATFORM HELPERS ----

async function publishToInstagram(igUserId: string, token: string, mediaUrl: string, caption: string, mediaType: "image" | "video") {
    // Step 1: Create Media Container
    const isVideo = mediaType === "video";
    let createContainerUrl = `https://graph.facebook.com/v19.0/${igUserId}/media?access_token=${token}&caption=${encodeURIComponent(caption)}`;

    if (isVideo) {
        createContainerUrl += `&media_type=REELS&video_url=${encodeURIComponent(mediaUrl)}`;
    } else {
        createContainerUrl += `&image_url=${encodeURIComponent(mediaUrl)}`;
    }

    const containerRes = await fetch(createContainerUrl, { method: "POST" });
    const containerData = await containerRes.json();

    if (containerData.error) {
        throw new Error(`IG Container Error: ${containerData.error.message}`);
    }

    const creationId = containerData.id;

    // Wait slightly for video processing if needed (Graph API sometimes needs a moment for REELS)
    if (isVideo) {
        await new Promise(r => setTimeout(r, 5000));
    }

    // Step 2: Publish Container
    const publishUrl = `https://graph.facebook.com/v19.0/${igUserId}/media_publish?creation_id=${creationId}&access_token=${token}`;
    const publishRes = await fetch(publishUrl, { method: "POST" });
    const publishData = await publishRes.json();

    if (publishData.error) {
        throw new Error(`IG Publish Error: ${publishData.error.message}`);
    }

    return publishData;
}

async function publishToFacebookPage(pageId: string, token: string, mediaUrl: string, caption: string, mediaType: "image" | "video") {
    // Facebook Page publishing is simpler. 
    // endpoint: /{page-id}/photos for images, /{page-id}/videos for video

    const endpoint = mediaType === "video" ? "videos" : "photos";
    const mediaParam = mediaType === "video" ? "file_url" : "url";

    // For FB videos, 'description' is used instead of 'message'. For photos, 'message' is used.
    let qs = `access_token=${token}&${mediaParam}=${encodeURIComponent(mediaUrl)}`;

    if (caption) {
        if (mediaType === "video") qs += `&description=${encodeURIComponent(caption)}`;
        else qs += `&message=${encodeURIComponent(caption)}`;
    }

    const postUrl = `https://graph.facebook.com/v19.0/${pageId}/${endpoint}?${qs}`;
    const res = await fetch(postUrl, { method: "POST" });
    const data = await res.json();

    if (data.error) {
        throw new Error(`FB Publish Error: ${data.error.message}`);
    }

    return data;
}

async function publishToTikTok(token: string, mediaUrl: string, caption: string) {
    // Note: TikTok Direct Post API requires the video to be sent via a direct POST 
    // to their /video/upload/ endpoint, or via their Webhook Inbox approach.
    // The "Direct Post" integration natively requires downloading the asset and pushing it as multipart/form-data.

    // 1. Download the video from our storage (or wherever assetUrl points)
    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) throw new Error("Failed to download video for TikTok upload.");

    const videoBlob = await videoRes.blob();

    // We need the file size for initialization
    const videoSize = videoBlob.size;

    // 2. Initialize the upload
    const initUrl = "https://open.tiktokapis.com/v2/post/publish/video/init/";
    const initRes = await fetch(initUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8"
        },
        body: JSON.stringify({
            post_info: {
                title: caption,
                privacy_level: "PUBLIC_TO_EVERYONE",
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
                video_cover_timestamp_ms: 1000
            },
            source_info: {
                source: "FILE_UPLOAD",
                video_size: videoSize,
                chunk_size: videoSize, // We are uploading the whole file in one chunk for simplicity (max 50MB usually)
                total_chunk_count: 1
            }
        })
    });

    const initData = await initRes.json();

    if (initData.error && initData.error.code !== "ok") {
        throw new Error(`TikTok Init Error: ${initData.error.message}`);
    }

    const publishId = initData.data.publish_id;
    const uploadUrl = initData.data.upload_url;

    // 3. Upload the video bytes
    const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
            "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
            "Content-Type": "video/mp4"
        },
        body: videoBlob
    });

    if (!uploadRes.ok) {
        throw new Error(`TikTok Video Upload chunks failed: ${uploadRes.status}`);
    }

    // TikTok handles the rest asynchronously after the final chunk is received.
    // We just return the publish_id so the UI or a cron job can check status later.
    return { publish_id: publishId };
}
