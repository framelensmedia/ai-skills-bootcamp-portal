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

const STAFF_ROLES = ["staff", "instructor", "editor", "admin", "super_admin"];

async function checkStaffAccess(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

    if (!profile || !STAFF_ROLES.includes(profile.role)) return null;
    return user;
}

// GET - Get lesson
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: lesson, error } = await supabase
            .from("lessons")
            .select("*, bootcamps(title, slug)")
            .eq("id", id)
            .single();

        if (error || !lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        return NextResponse.json({ lesson });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PUT - Update lesson
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Get current lesson to track bootcamp_id
        const { data: currentLesson } = await supabase
            .from("lessons")
            .select("bootcamp_id")
            .eq("id", id)
            .single();

        if (!currentLesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        // Map all possible fields
        const fields = [
            "title", "slug", "order_index", "learning_objective", "duration_minutes",
            "content_type", "video_url", "text_content", "create_action_type",
            "create_action_payload", "create_action_label", "create_action_description",
            "auto_save_output", "is_published"
        ];

        fields.forEach(field => {
            if (body[field] !== undefined) {
                if (field === "title" || field === "slug" || field === "learning_objective") {
                    updateData[field] = body[field]?.trim() || null;
                } else {
                    updateData[field] = body[field];
                }
            }
        });

        const { data: lesson, error } = await supabase
            .from("lessons")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "A lesson with this slug already exists in this bootcamp" }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update bootcamp stats
        await updateBootcampStats(supabase, currentLesson.bootcamp_id);

        return NextResponse.json({ lesson });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE - Delete lesson
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get bootcamp_id before deleting
        const { data: lesson } = await supabase
            .from("lessons")
            .select("bootcamp_id")
            .eq("id", id)
            .single();

        if (!lesson) {
            return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
        }

        const { error } = await supabase
            .from("lessons")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update bootcamp stats
        await updateBootcampStats(supabase, lesson.bootcamp_id);

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// Helper to update bootcamp stats
async function updateBootcampStats(supabase: any, bootcampId: string) {
    const { data: lessons } = await supabase
        .from("lessons")
        .select("duration_minutes")
        .eq("bootcamp_id", bootcampId)
        .eq("is_published", true);

    const lessonCount = lessons?.length || 0;
    const totalDuration = lessons?.reduce((sum: number, l: any) => sum + (l.duration_minutes || 0), 0) || 0;

    await supabase
        .from("bootcamps")
        .update({
            lesson_count: lessonCount,
            total_duration_minutes: totalDuration,
            updated_at: new Date().toISOString(),
        })
        .eq("id", bootcampId);
}
