import { compressImage } from "./compressImage";

/**
 * Robust client-side upload helper.
 * 1. Compresses images if applicable.
 * 2. Gets a signed upload URL from the backend.
 * 3. Uploads the file directly to Supabase Storage.
 * @returns The final public URL of the uploaded asset.
 */
export async function uploadFile(file: File): Promise<string> {
    let fileToUpload = file;

    // 1. Compression (for images only)
    if (file.type.startsWith("image/")) {
        try {
            fileToUpload = await compressImage(file, { maxWidth: 1280, quality: 0.8 });
        } catch (e) {
            console.warn("Compression failed, uploading original file", e);
        }
    }

    // 2. Get Signed Upload URL
    const signRes = await fetch("/api/sign-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            filename: fileToUpload.name,
            fileType: fileToUpload.type,
        }),
    });

    if (!signRes.ok) {
        const errorData = await signRes.json();
        throw new Error(errorData.error || "Failed to sign upload request");
    }

    const { signedUrl, publicUrl } = await signRes.json();

    // 3. Perform the actual upload to Supabase Storage
    const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { 
            "Content-Type": fileToUpload.type,
            // "upsert": "true" // Signed URL already includes metadata for upsert if desired
        },
        body: fileToUpload,
    });

    if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.statusText}`);
    }

    return publicUrl;
}
