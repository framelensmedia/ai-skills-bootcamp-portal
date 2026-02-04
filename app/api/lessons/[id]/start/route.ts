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

// POST - Mark mission as started (emit event)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: lessonId } = await params;
        const supabase = await createSupabaseServer();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get lesson info
        const { data: lesson, error: lessonError } = await supabase
            .from("lessons")
            .select("id, bootcamp_id, title, slug, bootcamps(slug)")
            .eq("id", lessonId)
            .single();

        if (lessonError || !lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        // Check if this is first start of bootcamp
        const { data: existingBootcampProgress } = await supabase
            .from("bootcamp_progress")
            .select("id")
            .eq("user_id", user.id)
            .eq("bootcamp_id", lesson.bootcamp_id)
            .single();

        const isBootcampStart = !existingBootcampProgress;

        // Upsert lesson progress as in_progress
        const { data: lessonProgress, error: progressError } = await supabase
            .from("lesson_progress")
            .upsert({
                user_id: user.id,
                lesson_id: lessonId,
                bootcamp_id: lesson.bootcamp_id,
                status: "in_progress",
                started_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, {
                onConflict: "user_id,lesson_id",
            })
            .select()
            .single();

        if (progressError) {
            console.error("Progress error:", progressError);
        }

        // Ensure bootcamp_progress exists
        if (isBootcampStart) {
            await supabase
                .from("bootcamp_progress")
                .upsert({
                    user_id: user.id,
                    bootcamp_id: lesson.bootcamp_id,
                    started_at: new Date().toISOString(),
                    last_accessed_at: new Date().toISOString(),
                }, {
                    onConflict: "user_id,bootcamp_id",
                });

            // Emit bootcamp_started event
            await supabase
                .from("mission_events")
                .insert({
                    user_id: user.id,
                    event_type: "bootcamp_started",
                    bootcamp_id: lesson.bootcamp_id,
                    payload: {
                        bootcamp_title: (lesson as any).bootcamps?.title,
                    },
                });
        }

        // Emit mission_started event
        const { data: event } = await supabase
            .from("mission_events")
            .insert({
                user_id: user.id,
                event_type: "mission_started",
                lesson_id: lessonId,
                bootcamp_id: lesson.bootcamp_id,
                payload: {
                    lesson_title: lesson.title,
                },
            })
            .select()
            .single();

        return NextResponse.json({
            success: true,
            lesson_progress: lessonProgress,
            event_id: event?.id,
            bootcamp_started: isBootcampStart,
        });

    } catch (e: any) {
        console.error("Lesson start API error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
