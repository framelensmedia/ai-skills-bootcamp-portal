
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase URL or Anon Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSignup() {
    const email = `test_signup_verif2_${Date.now()}@example.com`;
    const password = "password123";
    const fullName = "Test User Script";

    console.log(`Attempting to sign up user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) {
        console.error("Signup failed:", error);
        return;
    }

    console.log("Signup successful!");
    // console.log("User ID:", data.user?.id);
    // console.log("Session:", data.session ? "Active" : "Null (Pending Verification)");
    console.log("User Metadata received back:", data.user?.user_metadata);

    // Check profile
    if (data.user) {
        // Wait a bit for trigger
        await new Promise(r => setTimeout(r, 2000));

        // We need service_role key to check profiles easily if RLS blocks anon read of *other* users, 
        // but here we are the user (if session exists).
        // If session is null (email confirm on), we can't query profiles as that user easily.
        // So let's just use service role if available or output what we have.

        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);
            const { data: profile, error: profileError } = await adminClient
                .from("profiles")
                .select("*")
                .eq("user_id", data.user.id)
                .single();

            if (profileError) {
                console.error("Profile fetch failed:", profileError);
            } else {
                console.log("Profile created successfully:", profile);
            }
        } else {
            console.log("Skipping profile check (no service role key in env)");
        }
    }
}

testSignup();
