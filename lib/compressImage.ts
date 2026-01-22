export async function compressImage(file: File, options: { maxWidth?: number; quality?: number } = {}): Promise<File> {
    const { maxWidth = 1024, quality = 0.8 } = options;

    // 1. Always sanitize filename first (remove weird chars, ensure safe extension)
    // We'll target .webp for output, but keep original if fallback happens
    const baseName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_").replace(/\.[^/.]+$/, "");
    const safeName = `${baseName}.webp`;

    try {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        reject(new Error("Failed to get canvas context"));
                        return;
                    }

                    ctx.drawImage(img, 0, 0, width, height);

                    // Use WebP for best compression + transparency support
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                const newFile = new File([blob], safeName, {
                                    type: "image/webp",
                                    lastModified: Date.now(),
                                });
                                resolve(newFile);
                            } else {
                                reject(new Error("Canvas to Blob failed"));
                            }
                        },
                        "image/webp",
                        quality
                    );
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    } catch (error) {
        console.warn("Compression failed, falling back to original (sanitized)", error);
        // Fallback: Return original file but with SANITIZED name to prevent FormData crash
        // We keep original extension/type if fallback happens
        const fallbackName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        return new File([file], fallbackName, { type: file.type, lastModified: file.lastModified });
    }
}
