import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

type Body = {
  targetUserId: string;
  role: string; // user|staff|instructor|editor|admin|super_admin
  staff_pro?: boolean;
  staff_approved?: boolean;
  is_approved?: boolean;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    if (!body?.targetUserId) {
      return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
    }

    const supabaseUrl = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRole = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRole);

    // Update profile
    const updates: any = {
      role: body.role,
    };

    if (typeof body.staff_pro === "boolean") updates.staff_pro = body.staff_pro;
    if (typeof body.staff_approved === "boolean") updates.staff_approved = body.staff_approved;
    if (typeof body.is_approved === "boolean") updates.is_approved = body.is_approved;

    const { error } = await admin
      .from("profiles")
      .update(updates)
      .eq("user_id", body.targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server_error" }, { status: 500 });
  }
}
