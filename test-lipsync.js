const falKey = process.env.FAL_KEY;
if (!falKey) {
    console.error("No FAL_KEY found");
    process.exit(1);
}

const videoUrl = "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
async function test() {
    console.log("Submitting sync-lipsync...");
    try {
        const res = await fetch("https://queue.fal.run/fal-ai/sync-lipsync/v2/pro", {
            method: "POST",
            headers: { "Authorization": `Key ${falKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                video_url: videoUrl,
                audio_url: "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg"
            })
        });
        const { status_url, response_url } = await res.json();

        console.log("Polling...");
        for (let i = 0; i < 60; i++) {
            const statusRes = await fetch(status_url, { headers: { "Authorization": `Key ${falKey}` } });
            const st = await statusRes.json();
            console.log(`Poll ${i}: ${st.status}`);
            if (st.status === "COMPLETED") {
                const resultRes = await fetch(response_url, { headers: { "Authorization": `Key ${falKey}` } });
                const result = await resultRes.json();
                console.log(JSON.stringify(result, null, 2));
                break;
            }
            if (st.status === "ERROR" || st.status === "FAILED") {
                console.error(st);
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (err) {
        console.error(err);
    }
}

test();
