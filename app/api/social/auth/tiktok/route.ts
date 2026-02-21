import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import crypto from "crypto";
import { cookies } from "next/headers";

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
    const encodedState = Buffer.from(state).toString("base64");

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    if (!clientKey) {
        return NextResponse.json({ error: "TikTok Client Key not configured" }, { status: 500 });
    }

    // Determine the redirect URI dynamically
    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/social/callback/tiktok`;

    const scopes = [
        "user.info.basic",
        "video.upload",
        "video.publish"
    ].join(",");

    // PKCE implementation
    const codeVerifier = crypto.randomBytes(32).toString('hex');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // Base64URL encode

    const cookieStore = await cookies();
    cookieStore.set('tiktok_code_verifier', codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 10 // 10 minutes
    });

    // The TikTok OAuth URL format
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${scopes}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodedState}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    return NextResponse.redirect(authUrl);
}
