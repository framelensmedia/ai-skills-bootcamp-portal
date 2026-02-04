import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const STAFF_ROLES = ["staff", "instructor", "editor", "admin", "super_admin"];

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

async function checkStaffAccess(supabase: any): Promise<{ user: any; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { user: null, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (!profile || !STAFF_ROLES.includes(profile.role)) {
        return { user: null, error: "Forbidden" };
    }

    return { user };
}

// GET - List videos for a lesson
export async function GET(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();
        const { searchParams } = new URL(request.url);
        const lessonId = searchParams.get("lesson_id");

        if (!lessonId) {
            return NextResponse.json({ error: "lesson_id required" }, { status: 400 });
        }

        const { data: videos, error } = await supabase
            .from("lesson_videos")
            .select("*")
            .eq("lesson_id", lessonId)
            .order("order_index", { ascending: true });

        if (error) throw error;

        return NextResponse.json({ videos: videos || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST - Create or batch update videos for a lesson
export async function POST(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();
        const { user, error: authError } = await checkStaffAccess(supabase);
        if (authError || !user) {
            return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { lesson_id, videos } = body;

        if (!lesson_id || !Array.isArray(videos)) {
            return NextResponse.json({ error: "lesson_id and videos array required" }, { status: 400 });
        }

        // Delete existing videos for this lesson
        const { error: deleteError } = await supabase
            .from("lesson_videos")
            .delete()
            .eq("lesson_id", lesson_id);

        if (deleteError) throw deleteError;

        // Insert new videos
        if (videos.length > 0) {
            const videosToInsert = videos.map((v: any, index: number) => ({
                lesson_id,
                video_url: v.video_url,
                title: v.title || `Video ${index + 1}`,
                description: v.description || null,
                order_index: v.order_index ?? index,
                duration_seconds: v.duration_seconds || 60,
                thumbnail_url: v.thumbnail_url || null,
                is_published: v.is_published ?? true,
            }));

            const { data: insertedVideos, error: insertError } = await supabase
                .from("lesson_videos")
                .insert(videosToInsert)
                .select();

            if (insertError) throw insertError;

            return NextResponse.json({ videos: insertedVideos });
        }

        return NextResponse.json({ videos: [] });
    } catch (e: any) {
        console.error("Lesson videos API error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
