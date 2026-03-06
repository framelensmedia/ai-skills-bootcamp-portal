const { GoogleAuth } = require('./node_modules/google-auth-library');
const fs = require('fs');

async function test() {
    const envContent = fs.readFileSync('/Users/taloufilms/projects/AI-Skills-Bootcamp/web/.env.local', 'utf8');
    const keyMatch = envContent.match(/GOOGLE_APPLICATION_CREDENTIALS_JSON='([^']+)'/);
    if (!keyMatch) {
        console.error("No JSON in env");
        return;
    }
    const credentials = JSON.parse(keyMatch[1]);

    const projectId = "ai-skills-489323";
    const location = "us-central1";
    const modelId = "veo-2.0-generate-001";

    const auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const url = `https://${location}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

    const payload = {
        instances: [{ prompt: "A test prompt" }],
        parameters: { sampleCount: 1 }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const body = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${body}`);
}

test().catch(console.error);
