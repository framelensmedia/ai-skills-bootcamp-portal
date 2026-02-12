
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDuplicates() {
    console.log('Checking for duplicates...');

    // 1. Find bootcamp ID for 'basic-training'
    const { data: bootcamps, error: bcError } = await supabase
        .from('bootcamps')
        .select('id, title, slug')
        .eq('slug', 'basic-training');

    if (bcError) console.error(bcError);
    if (!bootcamps || bootcamps.length === 0) {
        console.log('Bootcamp "basic-training" not found.');
    } else {
        console.log(`Found ${bootcamps.length} bootcamps matching "basic-training":`);
        bootcamps.forEach(bc => console.log(` - [${bc.id}] ${bc.title} (${bc.slug})`));
    }

    // 2. Find lessons in that bootcamp(s) matching "AI Basics"
    if (bootcamps && bootcamps.length > 0) {
        for (const bc of bootcamps) {
            const { data: lessons, error: lError } = await supabase
                .from('lessons')
                .select('id, title, slug, is_published')
                .eq('bootcamp_id', bc.id)
                .ilike('title', '%AI%'); // Broad search

            if (lError) console.error(lError);
            console.log(`\nLessons in Bootcamp [${bc.slug}]:`);
            lessons.forEach(l => {
                console.log(` - [${l.id}] "${l.title}" (slug: ${l.slug}) Published: ${l.is_published}`);
            });
        }
    }
}

checkDuplicates();
