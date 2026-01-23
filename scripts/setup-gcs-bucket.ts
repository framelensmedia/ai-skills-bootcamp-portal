/**
 * Script to create GCS bucket for Veo video output
 * Run with: npx tsx scripts/setup-gcs-bucket.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { GoogleAuth } from "google-auth-library";

async function main() {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!projectId) {
        console.error("Missing GOOGLE_CLOUD_PROJECT_ID env var");
        process.exit(1);
    }

    const credsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credsJson) {
        console.error("Missing GOOGLE_APPLICATION_CREDENTIALS_JSON env var");
        process.exit(1);
    }

    const credentials = JSON.parse(credsJson);
    const auth = new GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    const client = await auth.getClient();
    const token = await client.getAccessToken();

    const bucketName = `${projectId}-veo-output`;
    const location = "US-CENTRAL1";

    console.log(`Creating bucket: ${bucketName}`);

    // Create bucket using JSON API
    const createUrl = `https://storage.googleapis.com/storage/v1/b?project=${projectId}`;

    const createRes = await fetch(createUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            name: bucketName,
            location: location,
            storageClass: "STANDARD",
        }),
    });

    if (createRes.ok) {
        console.log("✅ Bucket created successfully!");
    } else if (createRes.status === 409) {
        console.log("✅ Bucket already exists - that's fine!");
    } else {
        const err = await createRes.text();
        console.error(`❌ Failed to create bucket: ${createRes.status}`, err);
        process.exit(1);
    }

    // Get project number for Vertex AI service agent
    console.log("\nGetting project number...");
    const projectUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`;
    const projectRes = await fetch(projectUrl, {
        headers: { Authorization: `Bearer ${token.token}` },
    });

    if (!projectRes.ok) {
        console.error("Failed to get project info");
        process.exit(1);
    }

    const projectInfo = await projectRes.json();
    const projectNumber = projectInfo.projectNumber;
    console.log(`Project number: ${projectNumber}`);

    // Set IAM policy for the bucket
    console.log("\nSetting IAM permissions...");

    // Get current IAM policy
    const iamUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/iam`;
    const iamGetRes = await fetch(iamUrl, {
        headers: { Authorization: `Bearer ${token.token}` },
    });

    let policy: any = { bindings: [], version: 1 };
    if (iamGetRes.ok) {
        policy = await iamGetRes.json();
    }

    // Add Vertex AI service agent with objectAdmin role
    const vertexServiceAgent = `serviceAccount:service-${projectNumber}@gcp-sa-aiplatform.iam.gserviceaccount.com`;
    const ourServiceAccount = `serviceAccount:${credentials.client_email}`;

    const neededBindings = [
        { role: "roles/storage.objectAdmin", member: vertexServiceAgent },
        { role: "roles/storage.objectViewer", member: ourServiceAccount },
    ];

    for (const needed of neededBindings) {
        let binding = policy.bindings?.find((b: any) => b.role === needed.role);
        if (!binding) {
            binding = { role: needed.role, members: [] };
            policy.bindings = policy.bindings || [];
            policy.bindings.push(binding);
        }
        if (!binding.members.includes(needed.member)) {
            binding.members.push(needed.member);
            console.log(`Adding ${needed.member} to ${needed.role}`);
        } else {
            console.log(`${needed.member} already has ${needed.role}`);
        }
    }

    // Update IAM policy
    const iamSetRes = await fetch(iamUrl, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(policy),
    });

    if (iamSetRes.ok) {
        console.log("✅ IAM permissions set successfully!");
    } else {
        const err = await iamSetRes.text();
        console.error(`❌ Failed to set IAM: ${iamSetRes.status}`, err);
        process.exit(1);
    }

    console.log(`\n🎉 Setup complete! Bucket gs://${bucketName} is ready.`);
    console.log(`Add to .env.local: GCS_VIDEO_BUCKET=${bucketName}`);
}

main().catch(console.error);
