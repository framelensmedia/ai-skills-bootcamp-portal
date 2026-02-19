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

async function debugQuery() {
    console.log('Debugging query...');

    // 1. Try fetching just ids
    const { data: simpleData, error: simpleError } = await supabase
        .from('prompt_generations')
        .select('id')
        .eq('is_public', true)
        .limit(1);

    if (simpleError) {
        console.error('Error fetching simple IDs:', simpleError);
        return;
    }
    console.log('Simple fetch success. ID:', simpleData?.[0]?.id);

    // 2. Try fetching with profile relationship
    // Note: The syntax `profiles!user_id` implies a foreign key named `user_id` pointing to `profiles`.
    // Let's see if that works.
    const { data: relData, error: relError } = await supabase
        .from("prompt_generations")
        .select(`
           id,
           user_id,
           profiles!user_id ( full_name, username )
        `)
        .eq("is_public", true)
        .limit(1);

    if (relError) {
        console.error('Error fetching with relationship:', relError);
        // Try without explicit FK name if that failed
        console.log("Trying alternative relationship syntax...");
        const { data: relDataAlt, error: relErrorAlt } = await supabase
            .from("prompt_generations")
            .select(`
                id,
                user_id,
                profiles ( full_name, username )
                `)
            .eq("is_public", true)
            .limit(1);

        if (relErrorAlt) {
            console.error('Error fetching with alternative relationship:', relErrorAlt);
        } else {
            console.log('Alternative relationship fetch SUCCESS:', JSON.stringify(relDataAlt, null, 2));
        }

    } else {
        console.log('Relationship fetch SUCCESS:', JSON.stringify(relData, null, 2));
    }
}

debugQuery();
