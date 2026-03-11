"use client";

import { NleProvider } from "./_context/NleContext";
import { ArrowLeft, Play, MonitorPlay, Save, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import NleTimeline from "./_components/NleTimeline";
import NlePlaybackEngine from "./_components/NlePlaybackEngine";

import { useNle } from "./_context/NleContext";

function EditorWorkspace() {
    const { tracks, duration } = useNle();
    const [rendering, setRendering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleExport = async () => {
        try {
            setRendering(true);
            setError(null);

            const res = await fetch("/api/nle-render", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tracks, duration })
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to render");

            // Automatically download the final video
            const a = document.createElement('a');
            a.href = data.videoUrl;
            a.download = `Studio_NLE_Export.mp4`;
            a.click();

        } catch (err: any) {
            console.error("Export Error:", err);
            setError(err.message);
        } finally {
            setRendering(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="h-14 border-b border-white/10 bg-black/50 flex items-center justify-between px-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/library" className="text-white/50 hover:text-white transition p-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft size={18} />
                    </Link>
                    <div className="flex items-center gap-2">
                        <MonitorPlay className="text-indigo-400" size={18} />
                        <h1 className="font-bold text-sm tracking-wide">Studio Editor</h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExport}
                        disabled={rendering}
                        className="h-8 px-4 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                    >
                        {rendering ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {rendering ? "Rendering (Takes ~30s)..." : "Export Project (10 Cr)"}
                    </button>
                </div>
            </header>

            {/* Main Workspace Area */}
            {error && (
                <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 p-2 text-center text-xs font-bold">
                    Export Error: {error}
                </div>
            )}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Top Half: Video Preview Player */}
                <NlePlaybackEngine />

                {/* Bottom Half: Multi-Track Timeline */}
                <NleTimeline />

            </div>
        </div>
    );
}

export default function NlePage() {
    return (
        <NleProvider>
            <EditorWorkspace />
        </NleProvider>
    );
}
