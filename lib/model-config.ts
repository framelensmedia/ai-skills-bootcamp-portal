export const GENERATION_MODELS = [
    {
        id: "nano-banana-pro",
        label: "Gemini Image 3",
        description: "Fal.ai Preview",
        default: true,
    }
];

export const VIDEO_MODELS = [
    {
        id: "veo-3.1",
        label: "Google Veo",
        description: "Native Vertex AI",
        default: true,
    },
    // Grok temporarily disabled - timeout issues
    // {
    //     id: "grok-imagine-video",
    //     label: "Grok Imagine",
    //     description: "xAI via Fal.ai",
    // }
];

export const DEFAULT_MODEL_ID = "nano-banana-pro";
export const DEFAULT_VIDEO_MODEL_ID = "veo-3.1";
