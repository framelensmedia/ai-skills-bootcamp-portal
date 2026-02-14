
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
    try {
        // 1. Verify Session
        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = user.id;
        console.log(`⚠️ Requesting account deletion for user: ${userId}`);

        // 2. Initialize Service Role Client (for Admin actions)
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!serviceRoleKey || !supabaseUrl) {
            console.error("Missing Service Role Key or Supabase URL");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // 3. Delete from Auth (Triggers ON DELETE CASCADE in DB)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
            userId
        );

        if (deleteError) {
            console.error("Failed to delete user from Auth:", deleteError);
            return NextResponse.json(
                { error: "Failed to delete account" },
                { status: 500 }
            );
        }

        // 4. Cleanup Storage (Optional/Best Effort)
        // We try to clean up the avatar. 
        // Note: This assumes the avatar path convention is known or stored in profile.
        // Since the user is deleted, we might have lost the profile path if we didn't fetch it first.
        // For now, relies on DB cascades to clean up data. 
        // Storage might leave orphans, which can be cleaned up by a separate cron job or policy.

        console.log(`✅ Successfully deleted user: ${userId}`);

        // 5. Sign out the user session
        await supabase.auth.signOut();

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Delete Account Handler Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
