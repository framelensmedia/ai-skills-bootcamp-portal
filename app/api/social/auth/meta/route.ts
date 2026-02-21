import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspace_id") || "default";

    // We pass the workspaceId via the 'state' parameter to retrieve it in the callback
    const state = JSON.stringify({ userId: user.id, workspaceId });
    // Encode the state to base64 to avoid URL parsing issues
    const encodedState = Buffer.from(state).toString("base64");

    const appId = process.env.META_APP_ID;
    if (!appId) {
        return NextResponse.json({ error: "Meta App ID not configured" }, { status: 500 });
    }

    // Determine the redirect URI dynamically based on the current host
    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/social/callback/meta`;

    const scopes = [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_read_user_content",
        "business_management"
    ].join(",");

    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodedState}`;

    return NextResponse.redirect(authUrl);
}
