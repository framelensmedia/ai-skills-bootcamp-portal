import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const stateParam = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/social/callback/meta`;

    if (error) {
        console.error("Meta Auth Error:", error, errorDescription);
        return NextResponse.redirect(new URL(`/settings?error=meta_auth_failed&desc=${encodeURIComponent(errorDescription || error)}`, req.url));
    }

    if (!code || !stateParam) {
        return NextResponse.redirect(new URL(`/settings?error=missing_code_or_state`, req.url));
    }

    // Decode state
    let state;
    try {
        const decoded = Buffer.from(stateParam, "base64").toString("utf-8");
        state = JSON.parse(decoded);
    } catch (e) {
        return NextResponse.redirect(new URL(`/settings?error=invalid_state`, req.url));
    }

    const { userId, workspaceId } = state;

    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
        console.error("Missing Meta Credentials");
        return NextResponse.redirect(new URL(`/settings?error=server_configuration_error`, req.url));
    }

    try {
        // 1. Exchange the short-lived code for a short-lived access token
        const tokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
        const tokenRes = await fetch(tokenUrl);
        const tokenData = await tokenRes.json();

        if (tokenData.error) {
            console.error("Error exchanging code:", tokenData.error);
            throw new Error(tokenData.error.message || "Failed to exchange code");
        }

        const shortLivedToken = tokenData.access_token;

        // 2. Exchange short-lived token for a **long-lived** User Access Token
        const longTokenUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;
        const longTokenRes = await fetch(longTokenUrl);
        const longTokenData = await longTokenRes.json();

        if (longTokenData.error) {
            console.error("Error exchanging for long-lived token:", longTokenData.error);
            throw new Error(longTokenData.error.message || "Failed to exchange for long-lived token");
        }

        const longLivedToken = longTokenData.access_token;

        // 3. Fetch connected pages to get an Account ID (using the token)
        // Meta requires a Page Token or User Token mapped to the specific Instagram Business Account / Facebook Page.
        const pagesUrl = `https://graph.facebook.com/v19.0/me/accounts?access_token=${longLivedToken}`;
        const pagesRes = await fetch(pagesUrl);
        const pagesData = await pagesRes.json();

        if (pagesData.error) {
            throw new Error(pagesData.error.message || "Failed to fetch accounts");
        }

        console.log("RAW META PAGES RESPONSE:", JSON.stringify(pagesData, null, 2));

        const pages = pagesData.data || [];
        if (pages.length === 0) {
            return NextResponse.redirect(new URL(`/settings?error=no_facebook_pages_found`, req.url));
        }

        // For simplicity, grab the first connected page and check for an Instagram Business Account ID
        // In a full production UI, you'd present a list of pages for the user to select.
        const defaultPage = pages[0];
        const pageId = defaultPage.id;
        const pageToken = defaultPage.access_token;
        const pageName = defaultPage.name;

        // Also attempt to find the connected Instagram Account
        const igUrl = `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`;
        const igRes = await fetch(igUrl);
        const igData = await igRes.json();

        const igAccountId = igData.instagram_business_account?.id;

        // 4. Save to Database using Admin client (to bypass RLS if needed, or stick to normal client)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Save Facebook Page
        await supabaseAdmin.from("social_accounts").upsert({
            user_id: userId,
            workspace_id: workspaceId === "default" ? null : workspaceId,
            platform: "facebook",
            access_token: pageToken,
            account_id: pageId,
            account_name: pageName,
            updated_at: new Date().toISOString()
        }, { onConflict: "user_id, platform, account_id" });

        // Save Instagram Business Account if it exists
        if (igAccountId) {
            await supabaseAdmin.from("social_accounts").upsert({
                user_id: userId,
                workspace_id: workspaceId === "default" ? null : workspaceId,
                platform: "instagram",
                access_token: pageToken, // IG relies on the linked FB Page Token
                account_id: igAccountId,
                account_name: `${pageName} (Instagram)`,
                updated_at: new Date().toISOString()
            }, { onConflict: "user_id, platform, account_id" });
        }

        // Redirect back to settings with success parameter
        return NextResponse.redirect(new URL(`/settings?success=meta_connected`, req.url));

    } catch (e: any) {
        console.error("Meta Callback Error:", e);
        return NextResponse.redirect(new URL(`/settings?error=server_exception&desc=${encodeURIComponent(e.message)}`, req.url));
    }
}
