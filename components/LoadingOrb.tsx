import Image from "next/image";
import { useState, useEffect } from "react";

export default function LoadingOrb() {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const start = Date.now();
        const interval = setInterval(() => {
            setSeconds((Date.now() - start) / 1000);
        }, 100);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative w-full h-full overflow-hidden animate-fadeIn">
            {/* Full Screen Portal Orb */}
            <div className="absolute inset-0 w-full h-full">
                <Image
                    src="/orb-neon.gif"
                    alt="Generating..."
                    fill
                    className="object-cover opacity-90"
                    priority
                />
                {/* Vignette for depth */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
            </div>

            {/* Centered Text Overlay */}
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
                <h3 className="text-2xl font-bold text-white tracking-widest uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,1)] animate-pulse">
                    Generating
                </h3>
                <div className="h-1.5 w-48 bg-black/50 backdrop-blur-sm rounded-full overflow-hidden border border-white/10">
                    <div className="h-full bg-[#B7FF00] animate-[loading_2s_ease-in-out_infinite] w-1/3 shadow-[0_0_10px_#B7FF00]" />
                </div>
                <div className="text-xs font-mono text-white tracking-widest drop-shadow-md">
                    {seconds.toFixed(1)}s
                </div>
            </div>

            <style jsx global>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); width: 100%; }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
}
