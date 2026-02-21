import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/social/callback/tiktok`;

    if (error) {
        console.error("TikTok Auth Error:", error, errorDescription);
        return NextResponse.redirect(new URL(`/settings?error=tiktok_auth_failed&desc=${encodeURIComponent(errorDescription || error)}`, req.url));
    }

    if (!code || !stateParam) {
        return NextResponse.redirect(new URL(`/settings?error=missing_code_or_state`, req.url));
    }

    let state;
    try {
        const decoded = Buffer.from(stateParam, "base64").toString("utf-8");
        state = JSON.parse(decoded);
    } catch (e) {
        console.error("Failed to parse state param:", stateParam);
        console.error("State parse error:", e);
        return NextResponse.redirect(new URL(`/settings?error=invalid_state`, req.url));
    }

    const { userId, workspaceId } = state;

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
        console.error("Missing TikTok Credentials");
        return NextResponse.redirect(new URL(`/settings?error=server_configuration_error`, req.url));
    }

    try {
        // Retrieve PKCE code verifier from cookies
        const cookieStore = await cookies();
        const codeVerifierCookie = cookieStore.get('tiktok_code_verifier');
        const codeVerifier = codeVerifierCookie?.value;

        if (!codeVerifier) {
            console.error("Missing TikTok code verifier in cookies");
            return NextResponse.redirect(new URL(`/settings?error=missing_code_verifier`, req.url));
        }

        // Exchange code for token
        const tokenUrl = "https://open.tiktokapis.com/v2/oauth/token/";

        const params = new URLSearchParams();
        params.append("client_key", clientKey);
        params.append("client_secret", clientSecret);
        params.append("code", code);
        params.append("grant_type", "authorization_code");
        params.append("redirect_uri", redirectUri);
        params.append("code_verifier", codeVerifier);

        const tokenRes = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Cache-Control": "no-cache",
            },
            body: params.toString(),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error("Error exchanging TikTok code:", tokenData.error);
            throw new Error(tokenData.error_description || tokenData.error.message || "Failed to exchange code");
        }

        const accessToken = tokenData.access_token;
        const openId = tokenData.open_id; // Unique identifier for the user on TikTok

        // Fetch User Info to get display name
        const userInfoUrl = "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url";
        const userRes = await fetch(userInfoUrl, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });

        const userDataRaw = await userRes.json();

        if (userDataRaw.error) {
            throw new Error(userDataRaw.error.message || "Failed to fetch TikTok user info");
        }

        const displayName = userDataRaw.data?.user?.display_name || "TikTok User";

        // Save to Database
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabaseAdmin.from("social_accounts").upsert({
            user_id: userId,
            workspace_id: workspaceId === "default" ? null : workspaceId,
            platform: "tiktok",
            access_token: accessToken,
            account_id: openId,
            account_name: displayName,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id, platform, account_id" });

        return NextResponse.redirect(new URL(`/settings?success=tiktok_connected`, req.url));

    } catch (e: any) {
        console.error("TikTok Callback Error:", e);
        return NextResponse.redirect(new URL(`/settings?error=server_exception&desc=${encodeURIComponent(e.message)}`, req.url));
    }
}
