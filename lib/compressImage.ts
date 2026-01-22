export async function compressImage(file: File, options: { maxWidth?: number; quality?: number } = {}): Promise<File> {
    const { maxWidth = 1024, quality = 0.8 } = options;

    return new Promise((resolve, reject) => {
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

                // Preserve PNG transparency if original was PNG
                const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

                // For PNG, sanitizing filename extension
                let safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                if (outputType === "image/png" && !safeName.endsWith(".png")) {
                    safeName = safeName.replace(/\.[^/.]+$/, "") + ".png";
                } else if (outputType === "image/jpeg" && !safeName.endsWith(".jpg") && !safeName.endsWith(".jpeg")) {
                    safeName = safeName.replace(/\.[^/.]+$/, "") + ".jpg";
                }

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const newFile = new File([blob], safeName, {
                                type: outputType,
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            reject(new Error("Canvas to Blob failed"));
                        }
                    },
                    outputType,
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}
