
// Tool Registry Pattern for Model Agnosticism
// Defines available models and their configurations.

export type ModelProvider = 'google' | 'elevenlabs' | 'openai' | 'anthropic';

export interface AIModelConfig {
    id: string; // Internal ID (e.g. 'gemini-flash')
    name: string; // Display Name (e.g. 'Gemini 1.5 Flash')
    provider: ModelProvider;
    modelId: string; // API Model ID (e.g. 'gemini-1.5-flash-001')
    capabilities: ('text' | 'image' | 'video' | 'audio')[];
    contextWindow: number;
    costPerInputToken: number;
    costPerOutputToken: number;
    isActive: boolean;
}

export const TOOL_REGISTRY: Record<string, AIModelConfig> = {
    // Text / Reasoning
    'gemini-flash': {
        id: 'gemini-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'google',
        modelId: 'gemini-1.5-flash',
        capabilities: ['text', 'image'], // Multimodal input
        contextWindow: 1048576,
        costPerInputToken: 0.000000075, // $0.075 / 1M (example)
        costPerOutputToken: 0.0000003,
        isActive: true
    },
    'gemini-pro': {
        id: 'gemini-pro',
        name: 'Gemini 1.5 Pro',
        provider: 'google',
        modelId: 'gemini-1.5-pro',
        capabilities: ['text', 'image'],
        contextWindow: 2097152,
        costPerInputToken: 0.0000035,
        costPerOutputToken: 0.0000105,
        isActive: true
    },

    // Video
    'veo-3': {
        id: 'veo-3',
        name: 'Veo 3.1',
        provider: 'google',
        modelId: 'veo-3.1-fast-generate-001', // Example
        capabilities: ['video'],
        contextWindow: 0,
        costPerInputToken: 0, // Per second billing usually
        costPerOutputToken: 0,
        isActive: true
    },

    // Audio
    'eleven-turbo': {
        id: 'eleven-turbo',
        name: 'ElevenLabs Turbo v2.5',
        provider: 'elevenlabs',
        modelId: 'eleven_turbo_v2_5',
        capabilities: ['audio'],
        contextWindow: 0,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        isActive: true
    }
};

export function getModelConfig(modelId: string): AIModelConfig {
    const config = TOOL_REGISTRY[modelId];
    if (!config) {
        throw new Error(`Model configuration not found for ID: ${modelId}`);
    }
    return config;
}

export function getActiveModelsByCapability(capability: 'text' | 'image' | 'video' | 'audio'): AIModelConfig[] {
    return Object.values(TOOL_REGISTRY).filter(m => m.isActive && m.capabilities.includes(capability));
}
