const falKey = process.env.FAL_KEY;
if (!falKey) {
    console.error("No FAL_KEY found");
    process.exit(1);
}

async function getSchema(modelId) {
    try {
        const res = await fetch(`https://fal.run/${modelId}/openapi.json`, {
            headers: { "Authorization": `Key ${falKey}` }
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch schema for ${modelId}: ${res.status}`);
        }
        const json = await res.json();
        console.log(`\n=== Parameters for ${modelId} ===\n`);

        // The input schema is usually in components.schemas.Input
        const inputSchema = json.components?.schemas?.Input?.properties || json.components?.schemas?.PredictInput?.properties || {};

        for (const [key, value] of Object.entries(inputSchema)) {
            console.log(`- ${key}: ${value.type || value.anyOf?.[0]?.type || 'any'}`);
        }
    } catch (err) {
        console.error(err.message);
    }
}

async function main() {
    await getSchema("fal-ai/sync-lipsync/v2/pro");
}

main();
