"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

export default function PWAInstallButton() {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [showIOSInstructions, setShowIOSInstructions] = useState(false);

    useEffect(() => {
        // Check if already running in standalone mode
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
        if (isStandalone) return; // Don't show button if already installed

        // Check for iOS
        const userAgent = window.navigator.userAgent.toLowerCase();
        const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
        setIsIOS(isIosDevice);

        if (isIosDevice) {
            setSupportsPWA(true);
        }

        // Check for Chrome/Android install prompt
        const handler = (e: any) => {
            e.preventDefault();
            setPromptInstall(e);
            setSupportsPWA(true);
        };

        window.addEventListener("beforeinstallprompt", handler);

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();

        if (isIOS) {
            setShowIOSInstructions(!showIOSInstructions);
            // Auto-hide after 5 seconds
            if (!showIOSInstructions) {
                setTimeout(() => setShowIOSInstructions(false), 5000);
            }
        } else if (promptInstall) {
            promptInstall.prompt();
        }
    };

    if (!supportsPWA) return null;

    return (
        <div className="relative w-full">
            <button
                onClick={handleClick}
                className="flex w-full items-center gap-3 rounded-xl bg-gradient-to-r from-lime-400/20 to-lime-400/10 border border-lime-400/30 px-4 py-3 text-sm font-semibold text-lime-400 hover:bg-lime-400/20 transition group"
            >
                <Download size={18} className="group-hover:scale-110 transition" />
                <span>Run as App</span>
            </button>

            {/* iOS Instructions Tooltip/Banner */}
            {showIOSInstructions && (
                <div className="absolute left-0 right-0 top-full mt-2 p-3 rounded-lg bg-zinc-800 border border-white/10 shadow-xl z-50 text-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-start gap-3 text-white/90">
                        <Share size={20} className="mt-0.5 text-blue-400" />
                        <p>
                            Tap <span className="font-bold text-white">Share</span> then{" "}
                            <span className="font-bold text-white">"Add to Home Screen"</span>
                        </p>
                    </div>
                    <div className="absolute -top-1.5 left-8 w-3 h-3 bg-zinc-800 border-t border-l border-white/10 rotate-45 transform"></div>
                </div>
            )}
        </div>
    );
}
