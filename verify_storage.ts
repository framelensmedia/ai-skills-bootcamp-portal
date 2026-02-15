
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch'; // Ensure fetch is available in node env if not global

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStorage() {
    console.log('Checking Supabase Storage...');

    // List all buckets
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('Error listing buckets:', error);
        return;
    }

    console.log('Buckets found:', buckets.map(b => `${b.name} (public: ${b.public})`));

    const generationsBucket = buckets.find(b => b.name === 'generations');

    if (generationsBucket) {
        console.log('\n✅ "generations" bucket exists.');

        // Test Signed URL Generation
        console.log('\nTesting Signed Upload URL generation...');
        const now = Date.now();
        const testPath = `scratch/TEST_USER/${now}_verify_script.txt`;

        // mimic the API: use upsert: true
        const { data: signData, error: signError } = await supabase
            .storage
            .from('generations')
            .createSignedUploadUrl(testPath, { upsert: true });

        if (signError) {
            console.error('Error creating signed upload URL:', signError);
            return;
        }

        console.log('Signed URL Data:', signData);

        if (signData && signData.signedUrl.startsWith('http')) {
            console.log('✅ Signed URL is absolute.');

            // 3. Try to actually UPLOAD using this URL
            console.log('Attempting PUT upload to signed URL...');
            try {
                const uploadRes = await fetch(signData.signedUrl, {
                    method: 'PUT',
                    body: 'Hello World from Verify Script',
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                });

                if (uploadRes.ok) {
                    console.log('✅ Upload SUCCESS! Status:', uploadRes.status);
                    const text = await uploadRes.text();
                    console.log('Upload Response:', text);
                } else {
                    console.error('❌ Upload FAILED. Status:', uploadRes.status);
                    const errText = await uploadRes.text();
                    console.error('Error Text:', errText);
                }
            } catch (err) {
                console.error('❌ Fetch Error during upload:', err);
            }

        } else {
            console.log('⚠️ Signed URL is RELATIVE explicitly. This confirms the issue.');
        }

    } else {
        console.error('\n❌ "generations" bucket does NOT exist.');
    }
}

checkStorage();
