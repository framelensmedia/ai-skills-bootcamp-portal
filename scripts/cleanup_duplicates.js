
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupDuplicates() {
    console.log('Cleaning up duplicate items for AI Basics...');

    const lessonId = '74168e02-53cb-4a85-bf6a-6ee7dbe58d0c';

    // Fetch all items
    const { data: contents, error } = await supabase
        .from('lesson_contents')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('order_index');

    if (error) {
        console.error('Fetch error:', error);
        return;
    }

    console.log(`Found ${contents.length} items.`);

    // Simple dedupe strategy: Keep the latest created_at for each Title+Type combo
    // Actually, order_index is better.
    // Let's grouping by title and type.

    const seen = new Set();
    const toDelete = [];

    // Sort by created_at desc (keep newest)
    contents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    for (const item of contents) {
        const key = `${item.type}-${item.title}`;
        if (seen.has(key)) {
            toDelete.push(item.id);
        } else {
            seen.add(key);
        }
    }

    console.log(`Identified ${toDelete.length} duplicates to delete.`);

    if (toDelete.length > 0) {
        const { error: delError } = await supabase
            .from('lesson_contents')
            .delete()
            .in('id', toDelete);

        if (delError) console.error('Delete error:', delError);
        else console.log('✅ Duplicates deleted.');
    }
}

cleanupDuplicates();
