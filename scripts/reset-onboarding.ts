
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const TARGET_EMAIL = "frontstageevents@gmail.com";

async function resetOnboarding() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error("❌ Missing params in .env.local");
        return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get User ID from Auth
    // Note: listing users by email via admin api
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error("Failed to list users:", listError);
        return;
    }

    const user = users.find(u => u.email === TARGET_EMAIL);

    if (!user) {
        console.log(`❌ User ${TARGET_EMAIL} not found in Auth.`);
        return;
    }

    console.log(`Found user: ${user.id}`);

    // 2. Update Profile
    const { error: updateError } = await supabase
        .from("profiles")
        .update({
            onboarding_completed: false,
            // Optionally clear other fields if we want a fresh start
            username: null,
            full_name: null,
            avatar_url: null
        })
        .eq("user_id", user.id);

    if (updateError) {
        console.error("❌ Failed to update profile:", updateError);
    } else {
        console.log(`✅ Successfully reset onboarding for ${TARGET_EMAIL}`);
        console.log("   - set onboarding_completed = false");
        console.log("   - cleared username/profile data");
    }
}

resetOnboarding();
