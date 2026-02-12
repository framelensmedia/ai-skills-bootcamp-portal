
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSave() {
    console.log('Attempting to save a test lesson...');

    const testLesson = {
        title: "Debug Lesson " + Date.now(),
        slug: "debug-lesson-" + Date.now(),
        content_type: "mixed",
        duration_minutes: 15, // Intentionally > 10 to test constraint
        create_action_type: "guided_remix",
        bootcamp_id: "2c7d1e0a-9b4f-4a3c-8d2e-1f3g4h5i6j7k" // Placeholder, will fail FK probably, but we want to hit CHECK constraints first
    };

    // We need a valid bootcamp ID. Let's fetch one.
    const { data: bootcamps } = await supabase.from('bootcamps').select('id').limit(1);
    if (bootcamps && bootcamps.length > 0) {
        testLesson.bootcamp_id = bootcamps[0].id;
    } else {
        console.log("No bootcamps found, cannot test FK.");
        return;
    }

    console.log("Test Payload:", testLesson);

    const { data, error } = await supabase
        .from('lessons')
        .insert(testLesson)
        .select();

    if (error) {
        console.error('❌ Save Failed:', error);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        console.error('Message:', error.message);
    } else {
        console.log('✅ Save Successful!', data);
        // Cleanup
        await supabase.from('lessons').delete().eq('id', data[0].id);
    }
}

debugSave();
