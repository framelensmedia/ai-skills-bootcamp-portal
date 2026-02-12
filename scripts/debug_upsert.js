
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpsert() {
    // 1. Get the lesson ID
    const { data: lessons } = await supabase
        .from('lessons')
        .select('id')
        .ilike('title', '%AI Basics%')
        .limit(1);

    if (!lessons || lessons.length === 0) {
        console.error('Lesson not found');
        return;
    }
    const lessonId = lessons[0].id;
    console.log('Testing upsert for Lesson:', lessonId);

    // 2. Construct payloads
    // A. Legacy Video Item (Simulated)
    const item1 = {
        id: '00000000-0000-0000-0000-000000000001', // Explicit UUID
        lesson_id: lessonId,
        type: 'video',
        title: 'Test Video',
        order_index: 0,
        content: { video_url: 'http://test.com/vid.mp4', duration_seconds: 60 },
        is_published: true
    };

    // B. New Text Item (Simulated)
    const item2 = {
        id: '00000000-0000-0000-0000-000000000002',
        lesson_id: lessonId,
        type: 'text',
        title: 'Test Text',
        order_index: 1,
        content: { question: 'Some text' },
        is_published: undefined // Test undefined handling
    };

    const items = [item1, item2];

    console.log('Payload items:', items);

    // 3. Upsert
    const { data, error } = await supabase
        .from('lesson_contents')
        .upsert(items, { onConflict: 'id' })
        .select();

    if (error) {
        console.error('❌ Upsert Error:', error);
    } else {
        console.log('✅ Upsert Success. Rows:', data?.length);
        console.log(data);

        // Cleanup
        if (data && data.length > 0) {
            const { error: delError } = await supabase
                .from('lesson_contents')
                .delete()
                .in('id', data.map(d => d.id));
            if (delError) console.error('Cleanup error:', delError);
            else console.log('Cleanup done.');
        }
    }
}

testUpsert();
