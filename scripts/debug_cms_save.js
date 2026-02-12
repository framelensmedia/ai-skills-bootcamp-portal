
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Using Service Role to verify API logic behaves correctly when permissions are not an issue.
// If this works, then the issue is likely RLS for the logged-in user.

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSave() {
    console.log('Testing CMS Save Logic...');

    const lessonId = '74168e02-53cb-4a85-bf6a-6ee7dbe58d0c';
    const contentId = '5cc472ca-385c-4220-8b50-266ef640a21f'; // The existing Text Item

    // Payload mimicking what the CMS sends
    const payload = [
        {
            id: 'd9f9a941-4193-4ee2-b36d-5564883907c1', // Existing Video 1
            lesson_id: lessonId,
            type: 'video',
            title: 'The Opportunity',
            order_index: 0,
            content: { video_url: '...' },
            is_published: true
        },
        {
            id: '716940c1-37d4-4a6c-b95f-941198c2552a', // Existing Video 2
            lesson_id: lessonId,
            type: 'video',
            title: 'The Execution',
            order_index: 1,
            content: { video_url: '...' },
            is_published: true
        },
        {
            id: contentId, // The SAME ID as the existing text block
            lesson_id: lessonId,
            type: 'text',
            title: 'Information',
            order_index: 2,
            content: { question: 'TEST UPDATE 123' }, // The NEW content
            is_published: true
        }
    ];

    // 1. Upsert (Logic from route.ts)
    const { data, error } = await supabase
        .from('lesson_contents')
        .upsert(payload, { onConflict: 'id' })
        .select();

    if (error) {
        console.error('❌ Upsert Failed:', error);
    } else {
        console.log('✅ Upsert Success. Rows returned:', data.length);
        const updatedItem = data.find(i => i.id === contentId);
        console.log('Updated Item Content:', JSON.stringify(updatedItem?.content));
    }
}

testSave();
