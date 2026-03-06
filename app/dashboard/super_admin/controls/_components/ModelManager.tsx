'use client';

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type ModelConfig = {
    [key: string]: boolean;
};

export default function ModelManager() {
    const supabase = createSupabaseBrowserClient();
    const [loading, setLoading] = useState(true);
    const [paused, setPaused] = useState(false);
    const [models, setModels] = useState<ModelConfig>({
        "nano-banana-pro": true,
        "seedream-4k": true,
        "gemini-3-preview": true,
        "veo-3.1": true
    });
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        setErrorMsg(null);
        try {
            const { data: pausedConfig, error: pauseError } = await supabase
                .from("app_config")
                .select("value")
                .eq("key", "generations_paused")
                .maybeSingle();

            if (pauseError) {
                console.error("Pause config error:", pauseError);
                if (pauseError.code === "42P01") {
                    setErrorMsg("Database table 'app_config' is missing. Please run the schema script.");
                } else {
                    setErrorMsg(`Config load failed: ${pauseError.message}`);
                }
            }

            if (pausedConfig) {
                setPaused(pausedConfig.value === true || pausedConfig.value === "true");
            }

            const { data: modelsConfig } = await supabase
                .from("app_config")
                .select("value")
                .eq("key", "model_availability")
                .maybeSingle();

            if (modelsConfig && modelsConfig.value) {
                setModels((prev) => ({ ...prev, ...modelsConfig.value }));
            }
        } catch (e: any) {
            console.error("Failed to fetch config", e);
            setErrorMsg(e.message || "Unknown error loading config");
        } finally {
            setLoading(false);
        }
    };

    const togglePause = async () => {
        const newValue = !paused;
        setPaused(newValue);

        const { error } = await supabase
            .from("app_config")
            .upsert({ key: "generations_paused", value: newValue, description: "Global kill switch" });

        if (error) {
            console.error("Failed to update pause state", error);
            alert("Failed to save setting");
            setPaused(!newValue);
        }
    };

    const toggleModel = async (key: string) => {
        const newModels = { ...models, [key]: !models[key] };
        setModels(newModels);

        const { error } = await supabase
            .from("app_config")
            .upsert({ key: "model_availability", value: newModels, description: "Model availability map" });

        if (error) {
            console.error("Failed to update model config", error);
            setModels(models);
        }
    };

    if (loading) return <div className="p-4 text-white/50">Loading settings...</div>;

    return (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
            <h2 className="mb-4 text-xl font-bold text-white">System Controls</h2>

            {errorMsg && (
                <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-sm text-red-200">
                    <strong>Error:</strong> {errorMsg}
                </div>
            )}

            {/* Global Switch */}
            <div className="mb-8 flex items-center justify-between rounded-xl bg-red-500/10 p-4 border border-red-500/20">
                <div>
                    <h3 className="font-semibold text-red-200">Emergency Pause</h3>
                    <p className="text-xs text-red-200/60">Stop all generations globally immediately.</p>
                </div>
                <button
                    onClick={togglePause}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${paused ? "bg-red-500" : "bg-white/10"
                        }`}
                >
                    <span className="sr-only">Toggle Pause</span>
                    <span
                        className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${paused ? "translate-x-7" : "translate-x-1"
                            }`}
                    />
                </button>
            </div>

            {/* Models */}
            <div>
                <h3 className="mb-3 font-semibold text-white/80">Model Availability</h3>
                <div className="space-y-3">
                    {Object.entries(models).map(([key, enabled]) => (
                        <div key={key} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                            <span className="font-mono text-sm text-white/70">{key}</span>
                            <button
                                onClick={() => toggleModel(key)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-green-500" : "bg-zinc-600"
                                    }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"
                                        }`}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
