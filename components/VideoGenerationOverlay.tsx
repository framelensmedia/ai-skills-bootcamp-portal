"use client";

import { useEffect, useState } from "react";

export default function VideoGenerationOverlay() {
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        setTimer(0);
        const interval = setInterval(() => {
            setTimer((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/90 backdrop-blur-xl transition-all duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-lime-400/20 blur-xl rounded-full" />
                <div className="relative h-16 w-16 rounded-full border-4 border-lime-400 border-t-transparent animate-spin shadow-[0_0_30px_rgba(183,255,0,0.4)]" />
            </div>
            <div className="mt-6 text-lime-400 font-bold tracking-widest animate-pulse">GENERATING VIDEO</div>
            <div className="text-lime-400/60 font-mono text-xs mt-2">{timer}s</div>
        </div>
    );
}
