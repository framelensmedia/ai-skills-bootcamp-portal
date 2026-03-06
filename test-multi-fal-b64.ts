import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    const falKey = process.env.FAL_KEY;
    const model = 'fal-ai/nano-banana-2'; // or -pro
    const endpoint = `https://queue.fal.run/${model}/edit`;

    // Test payload with multiple images
    const payloadUrls = {
        prompt: "A beautiful scenery. [SUBJECT REPLACEMENT MODE] Replace the face of the person in Image 1 with the face of the Subject from Image 2.",
        image_urls: [
            "https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        ]
    };

    console.log("Submitting with one http URL and one base64...");
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

    // Let's poll it to see if it succeeds and if it complains about the base64 image
    const statusUrl = val.status_url;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(statusUrl, { headers: { "Authorization": `Key ${falKey}` } });
        const statusJson = await statusRes.json();
        if (statusJson.status === "COMPLETED") {
            const dataRes = await fetch(val.response_url, { headers: { "Authorization": `Key ${falKey}` } });
            const dataJson = await dataRes.json();
            console.log("Done Final Payload:", JSON.stringify(dataJson, null, 2));
            break;
        } else if (statusJson.status !== "IN_QUEUE" && statusJson.status !== "IN_PROGRESS") {
            console.error("Failed processing:", JSON.stringify(statusJson, null, 2));
            break;
        }
    }
}
test();
