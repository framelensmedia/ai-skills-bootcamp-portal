
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify Admin Role
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

    const role = String(profile?.role || "user").toLowerCase();
    if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { promptId, subjectMode } = body;

    if (!promptId || !subjectMode) {
        return NextResponse.json({ error: "Missing promptId or subjectMode" }, { status: 400 });
    }

    // Update subject_mode column
    // Also update template_config_json to match, to keep them in sync if the JSON exists

    // First fetch current config to merge
    const { data: currentPrompt } = await supabase
        .from("prompts")
        .select("template_config_json")
        .eq("id", promptId)
        .single();

    const newConfig = {
        ...(currentPrompt?.template_config_json || {}),
        subject_mode: subjectMode
    };

    const { error } = await supabase
        .from("prompts")
        .update({
            subject_mode: subjectMode,
            template_config_json: newConfig
        })
        .eq("id", promptId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, subjectMode });
}
