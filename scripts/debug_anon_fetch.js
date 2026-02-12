
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// STRICTLY use Anon Key to simulate browser
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnonFetch() {
    console.log('Testing Anon Fetch...');

    // 1. Get Lesson ID (we need to cheat a bit to find it, or use the known ID from previous debug)
    const knownLessonId = '74168e02-53cb-4a85-bf6a-6ee7dbe58d0c'; // From previous output
    console.log('Lesson ID:', knownLessonId);

    // 2. Try fetch contents
    const { data: contents, error } = await supabase
        .from("lesson_contents")
        .select("*")
        .eq("lesson_id", knownLessonId)
        .eq("is_published", true);

    if (error) {
        console.error('❌ Anon Fetch Error:', error);
    } else {
        console.log(`✅ Anon Fetch Success. Found ${contents.length} items.`);
        contents.forEach(c => console.log(` - [${c.type}] ${c.title}`));
    }
}

testAnonFetch();
