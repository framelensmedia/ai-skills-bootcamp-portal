import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export async function POST(req: Request) {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // Update step to 2 (Training Done)
        // Only if currently < 2
        const { data: ambassador } = await supabase
            .from("ambassadors")
            .select("onboarding_step")
            .eq("user_id", user.id)
            .single();

        if (ambassador && (ambassador.onboarding_step || 0) < 2) {
            await supabase
                .from("ambassadors")
                .update({ onboarding_step: 2 })
                .eq("user_id", user.id);
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
