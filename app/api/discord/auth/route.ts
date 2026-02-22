import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const appId = process.env.DISCORD_CLIENT_ID;
    if (!appId) {
        return NextResponse.json({ error: "Discord Client ID not configured" }, { status: 500 });
    }

    // Pass the user ID as the state to prevent CSRF and link it later
    const state = JSON.stringify({ userId: user.id });
    const encodedState = Buffer.from(state).toString("base64");

    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/discord/callback`;

    // Scopes required:
    // identify: To get the discord user ID
    // guilds.join: To add the user to the server
    const scope = "identify guilds.join";

    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodedState}`;

    return NextResponse.redirect(discordAuthUrl);
}
