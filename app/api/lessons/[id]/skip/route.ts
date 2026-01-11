import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: lessonId } = await params;
        const supabase = await createSupabaseServer();

        // Require auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get lesson to find bootcamp_id
        const { data: lesson, error: lessonError } = await supabase
            .from("lessons")
            .select("id, bootcamp_id, order_index")
            .eq("id", lessonId)
            .single();

        if (lessonError || !lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        // Upsert lesson progress as skipped
        const { data: lessonProgress, error: progressError } = await supabase
            .from("lesson_progress")
            .upsert({
                user_id: user.id,
                lesson_id: lessonId,
                bootcamp_id: lesson.bootcamp_id,
                status: "skipped",
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_id,lesson_id",
            })
            .select()
            .single();

        if (progressError) {
            return NextResponse.json({ error: progressError.message }, { status: 500 });
        }

        // Count completed/skipped lessons
        const { count: completedCount } = await supabase
            .from("lesson_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("bootcamp_id", lesson.bootcamp_id)
            .eq("status", "completed");

        const { count: skippedCount } = await supabase
            .from("lesson_progress")
            .select("*", { count: "exact", head: true })
            .eq("user_id", user.id)
            .eq("bootcamp_id", lesson.bootcamp_id)
            .eq("status", "skipped");

        // Upsert bootcamp progress
        const { data: bootcampProgress } = await supabase
            .from("bootcamp_progress")
            .upsert({
                user_id: user.id,
                bootcamp_id: lesson.bootcamp_id,
                current_lesson_index: lesson.order_index + 1,
                lessons_completed: completedCount || 0,
                lessons_skipped: skippedCount || 0,
                last_accessed_at: new Date().toISOString(),
            }, {
                onConflict: "user_id,bootcamp_id",
            })
            .select()
            .single();

        // Get next lesson
        const { data: nextLesson } = await supabase
            .from("lessons")
            .select("*")
            .eq("bootcamp_id", lesson.bootcamp_id)
            .eq("is_published", true)
            .gt("order_index", lesson.order_index)
            .order("order_index", { ascending: true })
            .limit(1)
            .single();

        return NextResponse.json({
            success: true,
            lesson_progress: lessonProgress,
            bootcamp_progress: bootcampProgress,
            next_lesson: nextLesson || null,
        });

    } catch (e: any) {
        console.error("Lesson skip API error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
