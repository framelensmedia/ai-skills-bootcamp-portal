import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function GET(req: Request) {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const stateStr = searchParams.get("state");

    const protocol = req.url.startsWith("https") || process.env.NODE_ENV === "production" ? "https" : "http";
    const host = req.headers.get("host") || "localhost:3000";
    const redirectUri = `${protocol}://${host}/api/discord/callback`;
    const dashboardUrl = `${protocol}://${host}/dashboard`;

    if (error || !code) {
        console.error("Discord Auth Error:", error);
        return NextResponse.redirect(`${dashboardUrl}?error=discord_auth_failed`);
    }

    let decodedState: { userId: string };
    try {
        decodedState = JSON.parse(Buffer.from(stateStr || "", "base64").toString("utf-8"));
    } catch (e) {
        console.error("Invalid state parameter", e);
        return NextResponse.redirect(`${dashboardUrl}?error=invalid_state`);
    }

    if (decodedState.userId !== user.id) {
        console.error("State user ID mismatch");
        return NextResponse.redirect(`${dashboardUrl}?error=user_mismatch`);
    }

    const clientId = process.env.DISCORD_CLIENT_ID!;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET!;
    const botToken = process.env.DISCORD_BOT_TOKEN!;
    const guildId = process.env.DISCORD_GUILD_ID!;
    const roleId = process.env.DISCORD_VIP_ROLE_ID!;

    if (!clientId || !clientSecret || !botToken || !guildId || !roleId) {
        console.error("Missing Discord environment variables");
        return NextResponse.redirect(`${dashboardUrl}?error=discord_config_missing`);
    }

    try {
        // 1. Exchange code for access token
        const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                code,
                redirect_uri: redirectUri,
            }),
        });

        if (!tokenResponse.ok) {
            const err = await tokenResponse.text();
            console.error("Failed to exchange token", err);
            return NextResponse.redirect(`${dashboardUrl}?error=discord_token_exchange_failed`);
        }

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error("Token exchange error:", tokenData);
            return NextResponse.redirect(`${dashboardUrl}?error=discord_token_failed`);
        }

        const userAccessToken = tokenData.access_token;

        // 2. Fetch Discord User ID
        const userResponse = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${userAccessToken}`,
            },
        });

        if (!userResponse.ok) {
            console.error("Failed to fetch Discord user");
            return NextResponse.redirect(`${dashboardUrl}?error=discord_fetch_user_failed`);
        }

        const discordUser = await userResponse.json();
        const discordUserId = discordUser.id;

        // 3. Verify user is PRO in Supabase
        const { data: profile } = await supabase
            .from("profiles")
            .select("subscription_tier")
            .eq("id", user.id)
            .single();

        if (profile?.subscription_tier !== "pro") {
            console.error("User is not a PRO subscriber");
            return NextResponse.redirect(`${dashboardUrl}?error=not_pro_subscriber`);
        }

        // 4. Add User to Guild & Assign Role (Using Bot Token)
        const addMemberUrl = `https://discord.com/api/guilds/${guildId}/members/${discordUserId}`;
        const addMemberPayload = {
            access_token: userAccessToken, // Require to add user (guilds.join scope)
            roles: [roleId],
        };

        const addMemberResponse = await fetch(addMemberUrl, {
            method: "PUT",
            headers: {
                "Authorization": `Bot ${botToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(addMemberPayload),
        });

        // 201 Created (Added), 204 No Content (Already in server)
        if (!addMemberResponse.ok && addMemberResponse.status !== 204 && addMemberResponse.status !== 201) {
            const err = await addMemberResponse.text();
            console.error("Failed to add member to guild or assign role", addMemberResponse.status, err);
            // Non-fatal, we still linked them, but worth logging
            return NextResponse.redirect(`${dashboardUrl}?error=discord_role_assignment_failed`);
        }

        // Optional: If 204, they were already in the server, so we need to PATCH to add the role
        if (addMemberResponse.status === 204) {
            const addRoleUrl = `https://discord.com/api/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
            const roleRes = await fetch(addRoleUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bot ${botToken}`
                }
            });
            if (!roleRes.ok) {
                console.error("Failed to patch role for existing member", await roleRes.text());
            }
        }

        // 5. Save discord_user_id to profiles
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ discord_user_id: discordUserId })
            .eq("id", user.id);

        if (updateError) {
            console.error("Failed to update profile", updateError);
            return NextResponse.redirect(`${dashboardUrl}?error=profile_update_failed`);
        }

        return NextResponse.redirect(`${dashboardUrl}?success=discord_linked`);

    } catch (error) {
        console.error("Discord callback Error:", error);
        return NextResponse.redirect(`${dashboardUrl}?error=discord_internal_error`);
    }
}
