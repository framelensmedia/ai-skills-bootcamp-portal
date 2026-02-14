
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function verifyServiceRole() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
        return;
    }

    console.log("🔑 Testing Service Role Key...");

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Try an admin action: Listing users (only possible with Service Role, ignores RLS)
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
        console.error("❌ Service Role Key FAILED:", error.message);
    } else {
        console.log("✅ Service Role Key WORKS!");
        console.log(`   Found ${users.length} users in Auth system.`);
        console.log("   (This confirms the key has Admin privileges and bypasses RLS)");
    }
}

verifyServiceRole();
