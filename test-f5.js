import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testF5() {
    const FAL_KEY = process.env.FAL_KEY;
    const refAudioUrl = "https://rdhsqobxynkilglrclks.supabase.co/storage/v1/object/public/voices/1da54ff8-869c-4e94-aae5-89fe8604d852/1772998676633_clone.mp4";
    const text = "Testing the voice generation right now.";

    console.log("Calling Fal.ai F5-TTS...");

    const response = await fetch(`https://fal.run/fal-ai/f5-tts`, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            gen_text: text,
            ref_audio_url: refAudioUrl,
            model_type: "F5-TTS",
            remove_silence: true
        })
    });

    if (!response.ok) {
        console.error("HTTP Error:", response.status, await response.text());
        return;
    }

    const data = await response.json();
    console.log("Response Data:", JSON.stringify(data, null, 2));
}

testF5();
