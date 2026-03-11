import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const FAL_KEY = process.env.FAL_KEY;

async function testMerge() {
    const payload = {
        video_url: "https://fal.media/files/kangaroo/PnBPfNJ8T9v8KFNAO_0WK_output.mp4",
        audio_url: "https://fal.media/files/b/0a916306/_4HTaZFEQlVeLeQdQzoKF_tmpm3xec72r.wav"
    };

    console.log("Submitting merge...");
    const res = await fetch("https://queue.fal.run/fal-ai/ffmpeg-api/merge-audio-video", {
        method: "POST",
        headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    const submitData = await res.json();
    const { request_id, status_url, response_url } = submitData;
    console.log("request_id:", request_id);
    console.log("status_url:", status_url);
    console.log("response_url:", response_url);

    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const st = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
        const data = await st.json();
        const status = (data.status || '');
        console.log(`Poll ${(i + 1) * 2}s: status="${status}"`);

        if (status.toUpperCase() === 'COMPLETED') {
            const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } });
            const result = await resultRes.json();
            console.log("FULL result:", JSON.stringify(result, null, 2));
            const url = result.video?.url || result.output?.video?.url || result.url || result.video_url;
            console.log("✅ Merge URL:", url);
            break;
        }
        if (status.toUpperCase() === 'FAILED') {
            console.error("❌ Failed:", JSON.stringify(data));
            break;
        }
    }
}

testMerge();
