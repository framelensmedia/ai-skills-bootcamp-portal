import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Bootcamp, Lesson, LessonProgress, BootcampProgress, BootcampWithLessons } from "@/lib/types/learning-flow";

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

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;
        const supabase = await createSupabaseServer();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Fetch bootcamp
        const { data: bootcamp, error: bootcampError } = await supabase
            .from("bootcamps")
            .select("*")
            .eq("slug", slug)
            .eq("is_published", true)
            .single();

        if (bootcampError || !bootcamp) {
            return NextResponse.json({ error: "Bootcamp not found" }, { status: 404 });
        }

        // Fetch lessons
        const { data: lessons, error: lessonsError } = await supabase
            .from("lessons")
            .select("*")
            .eq("bootcamp_id", bootcamp.id)
            .eq("is_published", true)
            .order("order_index", { ascending: true });

        if (lessonsError) {
            return NextResponse.json({ error: lessonsError.message }, { status: 500 });
        }

        // If user is logged in, fetch their progress
        let lessonProgressMap: Record<string, LessonProgress> = {};
        let contentProgressMap: Record<string, { content_id: string; is_completed: boolean }[]> = {};
        let userBootcampProgress: BootcampProgress | undefined;

        if (user) {
            // Lesson progress
            const { data: lessonProgress } = await supabase
                .from("lesson_progress")
                .select("*")
                .eq("user_id", user.id)
                .eq("bootcamp_id", bootcamp.id);

            if (lessonProgress) {
                lessonProgress.forEach((lp: LessonProgress) => {
                    lessonProgressMap[lp.lesson_id] = lp;
                });
            }

            // Content progress (granular)
            const { data: contentProgress } = await supabase
                .from("lesson_content_progress")
                .select("lesson_id, content_id, is_completed")
                .eq("user_id", user.id)
                .in("lesson_id", lessons?.map(l => l.id) || []);

            if (contentProgress) {
                contentProgress.forEach((cp: any) => {
                    if (!contentProgressMap[cp.lesson_id]) {
                        contentProgressMap[cp.lesson_id] = [];
                    }
                    contentProgressMap[cp.lesson_id].push({
                        content_id: cp.content_id,
                        is_completed: cp.is_completed
                    });
                });
            }

            // Bootcamp progress
            const { data: bcProgress } = await supabase
                .from("bootcamp_progress")
                .select("*")
                .eq("user_id", user.id)
                .eq("bootcamp_id", bootcamp.id)
                .single();

            userBootcampProgress = bcProgress || undefined;
        }

        // Combine lessons with progress
        const lessonsWithProgress = (lessons || []).map((lesson: Lesson) => ({
            ...lesson,
            progress: lessonProgressMap[lesson.id] || undefined,
            content_progress: contentProgressMap[lesson.id] || [],
        }));

        const response: BootcampWithLessons = {
            ...(bootcamp as Bootcamp),
            lessons: lessonsWithProgress,
            user_progress: userBootcampProgress,
        };

        return NextResponse.json(response);

    } catch (e: any) {
        console.error("Bootcamp detail API error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
