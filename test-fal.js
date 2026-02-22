// test-fal.js
require('dotenv').config({ path: '.env.local' });

async function testFal() {
    const falKey = process.env.FAL_KEY;
    console.log("FAL_KEY:", !!falKey);

    const imagesToSend = [
        "https://rsqhczwzvwbftfbbddab.supabase.co/storage/v1/object/public/generations/prompts/photo-1542204165-65bf26472b9b%20(1).webp", // template
        "https://rsqhczwzvwbftfbbddab.supabase.co/storage/v1/object/public/generations/fal-uploads/403061ce-3507-449e-ba61-ec853f0eedb3/1740227845353_60sbs0x.jpg", // subject
        "https://rsqhczwzvwbftfbbddab.supabase.co/storage/v1/object/public/generations/fal-uploads/403061ce-3507-449e-ba61-ec853f0eedb3/logo-1740227885078_b02wio1.png" // logo
    ];

    const payload = {
        prompt: "A beautiful scenery. [SUBJECT REPLACEMENT MODE - STRICT LAYOUT LOCK] 1. TASK: Face Swap. Replace the face of the person in Image 1 (Template) with the face of the Subject from Image 2. [LOGO MANDATE] You MUST place the final reference image (the Logo) onto the design. Maintain its aspect ratio and place it prominently.",
        safety_tolerance: "4",
        resolution: "1K",
        image_urls: imagesToSend,
        aspect_ratio: "9:16",
        strength: 0.85
    };

    const res = await fetch("https://queue.fal.run/fal-ai/nano-banana-pro/edit", {
        method: "POST",
        headers: {
            "Authorization": `Key ${falKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const val = await res.json();
    console.log("Enqueued! Request ID:", val.request_id);

    const statusUrl = val.status_url;

    // Polling longer
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000));

        const statusRes = await fetch(statusUrl, {
            headers: { "Authorization": `Key ${falKey}` }
        });

        const statusJson = await statusRes.json();

        if (statusJson.status === "COMPLETED") {
            const dataRes = await fetch(val.response_url, {
                headers: { "Authorization": `Key ${falKey}` }
            });
            const dataJson = await dataRes.json();
            console.log("Done Final Payload:", JSON.stringify(dataJson, null, 2));
            break;
        } else if (statusJson.status !== "IN_QUEUE" && statusJson.status !== "IN_PROGRESS") {
            console.error("Failed:", JSON.stringify(statusJson, null, 2));
            break;
        }

    }
}

testFal();
