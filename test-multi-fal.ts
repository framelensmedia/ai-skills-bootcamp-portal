import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const falKey = process.env.FAL_KEY;
    const model = 'fal-ai/nano-banana-2'; // or -pro
    const endpoint = `https://queue.fal.run/${model}/edit`;

    // Test payload with multiple images
    const payloadUrls = {
        prompt: "A dog and a cat.",
        image_urls: [
            "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg",
            "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg"
        ]
    };

    console.log("Submitting with image_urls array...");
    const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payloadUrls)
    });

    if (!res.ok) {
        console.error("Failed:", await res.text());
        return;
    }
    const val = await res.json();
    console.log("Success! Enqueued. Request ID:", val.request_id);
}
test();
