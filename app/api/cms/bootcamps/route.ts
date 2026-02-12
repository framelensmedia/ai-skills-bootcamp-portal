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

// Staff roles that can manage content
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

// GET - List all bootcamps (for CMS)
export async function GET(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: bootcamps, error } = await supabase
            .from("bootcamps")
            .select("*, lessons(count)")
            .order("created_at", { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ bootcamps });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST - Create new bootcamp
export async function POST(request: NextRequest) {
    try {
        const supabase = await createSupabaseServer();
        const user = await checkStaffAccess(supabase);

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Validate required fields
        if (!body.title?.trim()) {
            return NextResponse.json({ error: "Title is required" }, { status: 400 });
        }

        // Generate slug if not provided
        const slug = body.slug?.trim() || body.title.toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "");

        const { data: bootcamp, error } = await supabase
            .from("bootcamps")
            .insert({
                title: body.title.trim(),
                slug,
                description: body.description?.trim() || null,
                thumbnail_url: body.thumbnail_url || null,
                access_level: body.access_level || "free",
                is_published: body.is_published ?? false,
                is_featured: body.is_featured ?? false,
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                return NextResponse.json({ error: "A bootcamp with this slug already exists" }, { status: 400 });
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ bootcamp }, { status: 201 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
