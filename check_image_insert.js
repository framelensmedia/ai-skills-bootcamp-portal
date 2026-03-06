import { createClient } from "@supabase/supabase-js";
import 'dotenv/config'; // Make sure to load env vars

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRole) {
    console.error("Missing Superbase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRole);

async function check() {
    const { data, error } = await supabase.from("prompt_generations").insert({
        user_id: "c2bbab38-34ab-4a1f-8566-ae2d5eb338e3",
        prompt_id: null,
        prompt_slug: null,
        image_url: "https://fal.media/files/monkey/xyz.jpg",
        combined_prompt_text: "Edit image text",
        settings: {
            model: "fal-ai/nano-banana-pro",
            provider: "fal",
            status: "pending",
            input_images: 1,
            full_prompt: "Edit image text test",
            fal_request_id: null,
            fal_response_url: null
        }
    }).select().single();

    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Insert Success:", data.id);

        // Let's test update
        const { error: updErr } = await supabase.from("prompt_generations").update({
            image_url: "https://fal.media/files/monkey/xyz2.jpg",
            settings: {
                model: "fal-ai/nano-banana-pro",
                provider: "fal",
                status: "completed",
                input_images: 1,
                full_prompt: "Edit image text test"
            }
        }).eq("id", data.id);

        if (updErr) {
            console.error("Update Error:", updErr);
        } else {
            console.log("Update Success!");
        }

    }
}

check();
