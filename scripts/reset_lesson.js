
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetLesson() {
    console.log('Resetting AI Basics lesson content...');
    const lessonId = '74168e02-53cb-4a85-bf6a-6ee7dbe58d0c';

    // Delete all lesson_contents
    const { error: contentError } = await supabase
        .from('lesson_contents')
        .delete()
        .eq('lesson_id', lessonId);

    if (contentError) {
        console.error('Error deleting contents:', contentError);
    } else {
        console.log('✅ Deleted all lesson_contents.');
    }

    // Delete all lesson_videos (legacy) just in case
    const { error: videoError } = await supabase
        .from('lesson_videos')
        .delete()
        .eq('lesson_id', lessonId);

    if (videoError) {
        console.error('Error deleting videos:', videoError);
    } else {
        console.log('✅ Deleted all legacy lesson_videos.');
    }
}

resetLesson();
