export async function waitForVideoGeneration(
    generationId: string,
    onTick?: (attempt: number) => void
): Promise<string | null> {
    const MAX_ATTEMPTS = 120; // 10 minutes max (120 * 5s)
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        if (onTick) onTick(i + 1);
        try {
            const res = await fetch(`/api/check-video-generation?id=${generationId}`);
            if (!res.ok) continue;
            const json = await res.json();
            if (json.status === "completed" && json.videoUrl) {
                return json.videoUrl;
            }
        } catch {
            // keep retrying on network errors
        }
    }
    return null;
}
