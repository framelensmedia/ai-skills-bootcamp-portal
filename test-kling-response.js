const falKey = process.env.FAL_KEY;
if (!falKey) {
    console.error("No FAL_KEY found");
    process.exit(1);
}

// Use a known request ID from the recent logs
const requestId = "54e36676-4249-40fe-b0d4-e90fc0a48283";
const responseUrl = `https://queue.fal.run/fal-ai/kling-video/v3/standard/motion-control/requests/${requestId}`;

async function test() {
    console.log("\nChecking Response URL:", responseUrl);
    const res = await fetch(responseUrl, {
        headers: { "Authorization": `Key ${falKey}` }
    });
    console.log("Response Code:", res.status);

    if (res.ok) {
        const json = await res.json();
        console.log("Response JSON:", JSON.stringify(json, null, 2));
    } else {
        const text = await res.text();
        console.log("Response Error Text:", text);
    }
}

test();
