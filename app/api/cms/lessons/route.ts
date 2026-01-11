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

// POST - Create new lesson
export async function POST(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.bootcamp_id) {
            return NextResponse.json({ error: "Bootcamp ID is required" }, { status: 400 });
        }
        if (!body.title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }
        if (!body.create_action_type) {
            return NextResponse.json({ error: "Create action type is required" }, { status: 400 });
        }

        // Generate slug if not provided
        const slug = body.slug?.trim() || body.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        // Get next order_index
        const { data: existingLessons } = await supabase
            .from("lessons")
            .select("order_index")
            .eq("bootcamp_id", body.bootcamp_id)
            .order("order_index", { ascending: false })
            .limit(1);

        const nextIndex = existingLessons && existingLessons.length > 0
            ? existingLessons[0].order_index + 1
            : 0;

        const { data: lesson, error } = await supabase
            .from("lessons")
            .insert({
                bootcamp_id: body.bootcamp_id,
                title: body.title.trim(),
                slug,
                order_index: body.order_index ?? nextIndex,
                learning_objective: body.learning_objective?.trim() || null,
                duration_minutes: body.duration_minutes ?? 5,
                content_type: body.content_type || "text",
                video_url: body.video_url || null,
                text_content: body.text_content || null,
                create_action_type: body.create_action_type,
                create_action_payload: body.create_action_payload || {},
                create_action_label: body.create_action_label || "Create Now",
                create_action_description: body.create_action_description || null,
                auto_save_output: body.auto_save_output ?? true,
                is_published: body.is_published ?? false,
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "A lesson with this slug already exists in this bootcamp" }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Update bootcamp lesson count
        await updateBootcampStats(supabase, body.bootcamp_id);

        return NextResponse.json({ lesson }, { status: 201 });

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
