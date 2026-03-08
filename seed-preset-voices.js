import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const FAL_KEY = process.env.FAL_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const voices = ["Aurora", "Blade", "Britney", "Carl", "Cliff", "Richard", "Rico", "Siobhan", "Vicky"];

async function seedProfiles() {
    for (const voice of voices) {
        console.log(`Generating audio for ${voice}...`);
        try {
            const text = `Hi, I'm ${voice}. This is a preview of what my voice sounds like.`;
            const response = await fetch(`https://fal.run/resemble-ai/chatterboxhd/text-to-speech`, {
                method: 'POST',
                headers: {
                    'Authorization': `Key ${FAL_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice: voice
                })
            });

            if (!response.ok) {
                console.error(`Fal API Error for ${voice}:`, await response.text());
                continue;
            }

            const data = await response.json();
            const audioUrl = data.audio.url;

            console.log(`Downloading audio for ${voice}...`);
            const audioRes = await fetch(audioUrl);
            const arrayBuffer = await audioRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            console.log(`Uploading ${voice} to Supabase...`);
            const { data: uploadData, error } = await supabase.storage
                .from('voices')
                .upload(`presets/${voice.toLowerCase()}.wav`, buffer, {
                    contentType: 'audio/wav',
                    upsert: true
                });

            if (error) {
                console.error(`Upload error for ${voice}:`, error.message);
            } else {
                console.log(`Successfully uploaded ${voice}!`);
            }
        } catch (e) {
            console.error(`Error processing ${voice}:`, e.message);
        }
    }
    console.log("Done seeding voices!");
}

seedProfiles();
