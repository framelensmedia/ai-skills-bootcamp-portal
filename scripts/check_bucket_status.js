
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBucket() {
    console.log('Checking "bootcamp-videos" bucket status...');

    const bucketName = 'bootcamp-videos';
    const testFileName = 'test-upload.txt';
    const testContent = 'Hello World';

    // 1. Check if bucket exists (by trying to get it or list)
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Failed to list buckets:', listError);
        return;
    }

    const bucket = buckets.find(b => b.name === bucketName);
    if (!bucket) {
        console.log(`❌ Bucket "${bucketName}" NOT found.`);
        console.log('Available buckets:', buckets.map(b => b.name).join(', '));
        return;
    }

    console.log(`✅ Bucket "${bucketName}" found.`);
    console.log(`   Public: ${bucket.public}`);

    // 2. Try Upload
    console.log('Attempting test upload...');
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(testFileName, testContent, { upsert: true });

    if (uploadError) {
        console.error('❌ Upload failed:', uploadError);
        return;
    }
    console.log('✅ Upload successful.');

    // 3. Get Public URL
    const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(testFileName);

    const publicUrl = urlData.publicUrl;
    console.log('Public URL:', publicUrl);

    // 4. Test Public Access
    try {
        const fetch = (await import('node-fetch')).default; // Dynamic import for node-fetch v3+
        console.log('Testing public access...');
        const res = await fetch(publicUrl);
        if (res.ok) {
            console.log('✅ Public URL is accessible (Status: ' + res.status + ')');
        } else {
            console.log('❌ Public URL is NOT accessible (Status: ' + res.status + ')');
        }
    } catch (e) {
        // Fallback for environment without node-fetch
        console.log('Skipping public access fetch test (node-fetch might be missing). Please check URL manually.');
    }

    // 5. Cleanup
    // await supabase.storage.from(bucketName).remove([testFileName]);
}

checkBucket();
