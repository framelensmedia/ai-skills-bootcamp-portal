import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { username, full_name, avatar_url } = body;

        // Validate inputs
        if (username && username.length < 3) {
            return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });
        }

        // Prepare update object
        const updates: any = {};
        if (username) updates.username = username;
        if (full_name) updates.full_name = full_name;
        if (avatar_url) updates.profile_image = avatar_url; // Map avatar_url to profile_image

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ message: "No changes provided." });
        }

        // Update profile
        const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("user_id", user.id);

        if (error) {
            // Check for unique violation on username
            if (error.code === '23505') { // Postgres unique_violation
                return NextResponse.json({ error: "Username is already taken. Please choose another." }, { status: 409 });
            }
            console.error("Profile update error:", error);
            return NextResponse.json({ error: "Failed to update profile." }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: "Profile updated successfully." });

    } catch (err: any) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
