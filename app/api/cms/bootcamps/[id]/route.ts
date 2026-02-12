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

// GET - Get bootcamp with lessons
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

        const { data: bootcamp, error } = await supabase
            .from("bootcamps")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !bootcamp) {
            return NextResponse.json({ error: "Bootcamp not found" }, { status: 404 });
        }

        // Get lessons
        const { data: lessons } = await supabase
            .from("lessons")
            .select("*")
            .eq("bootcamp_id", id)
            .order("order_index", { ascending: true });

        return NextResponse.json({ bootcamp, lessons: lessons || [] });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// PUT - Update bootcamp
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

        const updateData: any = {
            updated_at: new Date().toISOString(),
        };

        if (body.title !== undefined) updateData.title = body.title.trim();
        if (body.slug !== undefined) updateData.slug = body.slug.trim();
        if (body.description !== undefined) updateData.description = body.description?.trim() || null;
        if (body.thumbnail_url !== undefined) updateData.thumbnail_url = body.thumbnail_url || null;
        if (body.access_level !== undefined) updateData.access_level = body.access_level;
        if (body.access_level !== undefined) updateData.access_level = body.access_level;
        if (body.is_published !== undefined) updateData.is_published = body.is_published;
        if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;

        const { data: bootcamp, error } = await supabase
            .from("bootcamps")
            .update(updateData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "A bootcamp with this slug already exists" }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ bootcamp });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE - Delete bootcamp
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

        const { error } = await supabase
            .from("bootcamps")
            .delete()
            .eq("id", id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
