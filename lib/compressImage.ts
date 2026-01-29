/**
 * Compress and resize an image file for upload.
 * - Always outputs JPEG for maximum compatibility (iOS, Android, Desktop)
 * - Handles HEIC, PNG, JPEG, WebP inputs via browser's native codec
 * - Aggressive compression to ensure files stay under Vercel's 4.5MB limit
 */
export async function compressImage(
    file: File,
    options: { maxWidth?: number; quality?: number } = {}
): Promise<File> {
    const { maxWidth = 1280, quality = 0.8 } = options;

    // Sanitize filename (remove special chars, use .jpg extension)
    const baseName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
    const safeName = `${baseName}.jpg`;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onerror = () => {
            console.warn("FileReader failed, returning sanitized original");
            resolve(createFallbackFile(file));
        };

        reader.onload = (event) => {
            const img = new Image();

            img.onerror = () => {
                console.warn("Image load failed (possibly unsupported format), returning sanitized original");
                resolve(createFallbackFile(file));
            };

            img.onload = () => {
                try {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    // Resize if needed
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        console.warn("Canvas context failed, returning sanitized original");
                        resolve(createFallbackFile(file));
                        return;
                    }

                    // Draw image to canvas
                    ctx.drawImage(img, 0, 0, width, height);

                    // Always use JPEG for maximum compatibility
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const compressedFile = new File([blob], safeName, {
                                    type: "image/jpeg",
                                    lastModified: Date.now(),
                                });

                                // Log compression result for debugging
                                const reduction = Math.round((1 - blob.size / file.size) * 100);
                                console.log(
                                    `Compressed: ${file.name} (${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB, ${reduction}% reduction)`
                                );

                                resolve(compressedFile);
                            } else {
                                console.warn("toBlob returned null, returning sanitized original");
                                resolve(createFallbackFile(file));
                            }
                        },
                        "image/jpeg",
                        quality
                    );
                } catch (err) {
                    console.warn("Canvas operation failed:", err);
                    resolve(createFallbackFile(file));
                }
            };

            img.src = event.target?.result as string;
        };

        reader.readAsDataURL(file);
    });
}

/**
 * Create a sanitized fallback file when compression fails.
 * This ensures FormData doesn't crash on special characters.
 */
function createFallbackFile(file: File): File {
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "image.jpg";
    return new File([file], safeName, {
        type: file.type || "image/jpeg",
        lastModified: file.lastModified,
    });
}
