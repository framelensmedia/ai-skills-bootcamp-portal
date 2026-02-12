
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLessonContents() {
    // 1. Find the lesson ID for 'AI Basics'
    const { data: lessons, error: lessonError } = await supabase
        .from('lessons')
        .select('id, title, bootcamp_id')
        .ilike('title', '%AI Basics%');

    if (lessonError) {
        console.error('Error finding lesson:', lessonError);
        return;
    }

    if (!lessons || lessons.length === 0) {
        console.log('Lesson "AI Basics" not found.');
        return;
    }

    console.log(`Found ${lessons.length} lessons matching "AI Basics":`);

    for (const lesson of lessons) {
        console.log(`\nLesson ID: ${lesson.id}, Title: ${lesson.title}`);

        // 2. Check for lesson_contents
        const { data: contents, error: contentError } = await supabase
            .from('lesson_contents')
            .select('id, type, title, content, is_published')
            .eq('lesson_id', lesson.id)
            .order('order_index');

        if (contentError) {
            console.error('Error finding contents:', contentError);
        } else {
            console.log(`  Found ${contents ? contents.length : 0} content items:`);
            if (contents) {
                contents.forEach(c => {
                    console.log(`    - [${c.type}] ${c.title} (Published: ${c.is_published})`);
                    if (c.type === 'text') {
                        console.log(`      Full Item:`, JSON.stringify(c, null, 2));
                    }
                });
            }
        }

        // 3. Test Insert (to check constraints)
        console.log('  Attempting test insert...');
        const testItem = {
            lesson_id: lesson.id,
            type: 'text',
            title: 'Test Text Block',
            order_index: 99,
            content: { question: 'This is a test.' },
            is_published: false
        };

        const { data: insertData, error: insertError } = await supabase
            .from('lesson_contents')
            .insert(testItem)
            .select();

        if (insertError) {
            console.error('  ❌ Insert failed:', insertError.message);
            console.error('  Details:', insertError.details || insertError.hint);
        } else {
            console.log('  ✅ Insert successful:', insertData[0].id);
            // Cleanup
            await supabase.from('lesson_contents').delete().eq('id', insertData[0].id);
            console.log('  Cleaned up test item.');
        }

        // 4. Check for legacy lesson_videos
        const { data: videos, error: videoError } = await supabase
            .from('lesson_videos')
            .select('id, title, video_url')
            .eq('lesson_id', lesson.id);

        if (videoError) {
            console.error('Error finding videos:', videoError);
        } else {
            console.log(`  Found ${videos ? videos.length : 0} legacy videos.`);
        }
    }
}

checkLessonContents();
