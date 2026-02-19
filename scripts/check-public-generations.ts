import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase URL or Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPublicGenerations() {
    console.log('Checking for public prompt generations...');

    const { count, error } = await supabase
        .from('prompt_generations')
        .select('*', { count: 'exact', head: true })
        .eq('is_public', true);

    if (error) {
        console.error('Error fetching count:', error);
        return;
    }

    console.log(`Found ${count} public prompt generations.`);

    if (count === 0) {
        console.log("No public generations found. This is why the section is hidden.");
    } else {
        console.log("Data exists. The issue might be in the query or frontend rendering.");

        // Fetch a few to see structure
        const { data } = await supabase
            .from('prompt_generations')
            .select(`
            id, image_url, created_at, upvotes_count, settings, original_prompt_text, remix_prompt_text, combined_prompt_text,
            user_id, prompt_id,
            profiles!user_id ( full_name, username, profile_image )
        `)
            .eq("is_public", true)
            .limit(2);

        console.log("Sample data:", JSON.stringify(data, null, 2));
    }
}

checkPublicGenerations();
