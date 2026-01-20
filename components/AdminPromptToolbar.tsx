
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminPromptToolbar({
    promptId,
    initialSubjectMode,
    onUpdate
}: {
    promptId: string;
    initialSubjectMode: "human" | "non_human";
    onUpdate?: (newMode: "human" | "non_human") => void;
}) {
    const router = useRouter();
    const [subjectMode, setSubjectMode] = useState(initialSubjectMode);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState("");

    const handleSave = async (newMode: "human" | "non_human") => {
        setSubjectMode(newMode);
        setSaving(true);
        setMsg("");

        try {
            const res = await fetch("/api/admin/prompts/update", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    promptId,
                    subjectMode: newMode
                })
            });

            if (!res.ok) {
                const json = await res.json();
                throw new Error(json.error || "Update failed");
            }

            setMsg("Saved!");
            if (onUpdate) onUpdate(newMode);
            setTimeout(() => setMsg(""), 2000);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 rounded-xl border border-red-500/50 bg-black/90 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-wider">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Admin Controls
            </div>

            <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">Subject Mode</label>
                    <div className="flex bg-white/10 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => handleSave("human")}
                            disabled={saving}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subjectMode === "human"
                                    ? "bg-red-500 text-white"
                                    : "text-white/40 hover:text-white"
                                }`}
                        >
                            Human
                        </button>
                        <button
                            onClick={() => handleSave("non_human")}
                            disabled={saving}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${subjectMode === "non_human"
                                    ? "bg-red-500 text-white"
                                    : "text-white/40 hover:text-white"
                                }`}
                        >
                            Object
                        </button>
                    </div>
                </div>
            </div>

            {msg && <div className="text-xs text-green-400 font-mono text-center">{msg}</div>}
        </div>
    );
}
