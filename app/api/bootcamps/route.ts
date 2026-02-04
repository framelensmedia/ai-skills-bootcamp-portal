import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Bootcamp, BootcampProgress } from "@/lib/types/learning-flow";

async function createSupabaseServer() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                },
            },
        }
    );
}

export async function GET(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();

        // Get current user (optional - for progress)
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch published bootcamps
        const { data: bootcamps, error } = await supabase
            .from("bootcamps")
            .select("*")
            .eq("is_published", true)
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // If user is logged in, fetch their progress
        let userProgress: Record<string, BootcampProgress> = {};

        if (user) {
            const { data: progressData } = await supabase
                .from("bootcamp_progress")
                .select("*")
                .eq("user_id", user.id);

            if (progressData) {
                progressData.forEach((p: BootcampProgress) => {
                    userProgress[p.bootcamp_id] = p;
                });
            }
        }

        return NextResponse.json({
            bootcamps: bootcamps as Bootcamp[],
            user_progress: userProgress,
        });

    } catch (e: any) {
        console.error("Bootcamps API error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
