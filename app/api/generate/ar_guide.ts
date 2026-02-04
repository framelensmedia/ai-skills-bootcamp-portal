import sharp from "sharp";

// Helper to generate a transparent aspect ratio guide
export async function createAspectGuide(ar: string): Promise<Buffer> {
    let width = 1024;
    let height = 768; // Default 4:3

    if (ar === "1:1") { width = 1024; height = 1024; }
    else if (ar === "16:9") { width = 1216; height = 832; }
    else if (ar === "9:16") { width = 832; height = 1216; }
    else if (ar === "4:3") { width = 1024; height = 768; }
    else if (ar === "3:4") { width = 768; height = 1024; }
    else if (ar === "21:9") { width = 1536; height = 640; }
    else if (ar === "9:21") { width = 640; height = 1536; }

    return await sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
    })
        .png()
        .toBuffer();
}
