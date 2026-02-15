
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";

// Load environment variables for BOTH projects
// You can create a .env.migration file or just set these in the terminal
// OLD_SUPABASE_URL=...
// OLD_SUPABASE_SERVICE_ROLE_KEY=...
// NEW_SUPABASE_URL=...
// NEW_SUPABASE_SERVICE_ROLE_KEY=...

// For this script to work, you might need to temporarily edit it or pass vars inline.
// We will look for them in process.env

const OLD_URL = process.env.OLD_SUPABASE_URL;
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
    console.error("Missing Migration Env Vars!");
    console.error("Usage: OLD_SUPABASE_URL=... OLD_SUPABASE_SERVICE_ROLE_KEY=... NEW_SUPABASE_URL=... NEW_SUPABASE_SERVICE_ROLE_KEY=... npx tsx migrate_storage.ts");
    process.exit(1);
}

const oldSupabase = createClient(OLD_URL, OLD_KEY);
const newSupabase = createClient(NEW_URL, NEW_KEY);

// List of buckets to migrate
const BUCKETS = ["generations", "avatars", "workspace_assets", "identities"];

async function migrateBucket(bucketName: string) {
    console.log(`\n📦 Migrating Bucket: ${bucketName}...`);

    // 1. Ensure bucket exists in new project
    const { data: buckets } = await newSupabase.storage.listBuckets();
    const bucketExists = buckets?.find(b => b.name === bucketName);

    if (!bucketExists) {
        console.log(`Creating bucket '${bucketName}' in new project...`);
        const { error } = await newSupabase.storage.createBucket(bucketName, {
            public: true, // Defaulting to public, adjust if sensitive
            fileSizeLimit: 52428800, // 50MB
        });
        if (error) console.error(`Failed to create bucket ${bucketName}:`, error.message);
    }

    // 2. List all files in old bucket
    // Note: This naive listing only gets top-level or limited depth. 
    // Ideally requires recursive listing.

    // Helper for recursive listing
    async function listAllFiles(pathPrefix = ""): Promise<any[]> {
        let allFiles: any[] = [];
        const { data, error } = await oldSupabase.storage.from(bucketName).list(pathPrefix, {
            limit: 100,
            offset: 0,
        });

        if (error) {
            console.error(`Error listing ${bucketName}/${pathPrefix}:`, error);
            return [];
        }

        if (!data) return [];

        for (const item of data) {
            if (item.id === null) {
                // It's a folder
                const folderFiles = await listAllFiles(`${pathPrefix}${item.name}/`);
                allFiles = [...allFiles, ...folderFiles];
            } else {
                // It's a file
                allFiles.push({ ...item, fullPath: `${pathPrefix}${item.name}` });
            }
        }
        return allFiles;
    }

    const files = await listAllFiles();
    console.log(`Found ${files.length} files in ${bucketName}.`);

    // 3. Migrate Files
    for (const file of files) {
        console.log(`Transferring: ${file.fullPath}`);

        // Download from OLD
        const { data: blob, error: downloadError } = await oldSupabase.storage.from(bucketName).download(file.fullPath);

        if (downloadError || !blob) {
            console.error(`Failed to download ${file.fullPath}:`, downloadError);
            continue;
        }

        // Convert Blob to Buffer/ArrayBuffer
        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Upload to NEW
        const { error: uploadError } = await newSupabase.storage.from(bucketName).upload(file.fullPath, buffer, {
            contentType: blob.type,
            upsert: true
        });

        if (uploadError) {
            console.error(`Failed to upload ${file.fullPath}:`, uploadError);
        }
    }
}

async function main() {
    for (const bucket of BUCKETS) {
        await migrateBucket(bucket);
    }
    console.log("\n✅ Storage Migration Complete.");
}

main();
