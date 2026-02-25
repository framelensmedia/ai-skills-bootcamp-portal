/**
 * Polls /api/check-generation until the generation is complete or times out.
 * Used by frontend call sites after receiving a 202 "pending" response from /api/generate.
 */
export async function waitForGeneration(
    generationId: string,
    onTick?: (attempt: number) => void
): Promise<string | null> {
    const MAX_ATTEMPTS = 60; // 5 minutes max (60 × 5s)
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        if (onTick) onTick(i + 1);
        try {
            const res = await fetch(`/api/check-generation?id=${generationId}`);
            if (!res.ok) continue;
            const json = await res.json();
            if (json.status === "completed" && json.imageUrl) {
                return json.imageUrl;
            }
        } catch {
            // network blip — keep retrying
        }
    }
    return null;
}
