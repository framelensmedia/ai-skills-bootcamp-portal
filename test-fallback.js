import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testChatterbox() {
    const FAL_KEY = process.env.FAL_KEY;
    const voiceId = "Aurora";
    const text = "Testing the preset voice generation right now. Hello world.";

    console.log("Calling Fal.ai ChatterboxHD...");

    try {
        const response = await fetch(`https://fal.run/resemble-ai/chatterboxhd/text-to-speech`, {
            method: 'POST',
            headers: {
                'Authorization': `Key ${FAL_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                voice: voiceId
            })
        });

        if (!response.ok) {
            console.error("HTTP Error:", response.status, await response.text());
            return;
        }

        const data = await response.json();
        console.log("Response Data:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Fetch failed:", error);
    }
}

testChatterbox();
