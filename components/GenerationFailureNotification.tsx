"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";

interface GenerationFailureNotificationProps {
    error: string | null;
    onClose: () => void;
    onRetry: () => void;
}

export function GenerationFailureNotification({ error, onClose, onRetry }: GenerationFailureNotificationProps) {
    const [timeLeft, setTimeLeft] = useState(5);

    useEffect(() => {
        if (!error) return;

        // Reset countdown on new error
        setTimeLeft(5);

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [error]);

    if (!error) return null;

    return (
        <div className="fixed bottom-6 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 px-4">
            <div className="flex animate-in slide-in-from-bottom-5 items-start gap-4 rounded-2xl border border-red-500/20 bg-red-950/90 p-4 shadow-2xl backdrop-blur-md">
                <div className="shrink-0 text-red-400">
                    <AlertCircle size={24} />
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-white">Generation Failed</h3>
                    <p className="mt-1 text-sm text-red-200/80 leading-relaxed font-medium">
                        {error}
                    </p>

                    <button
                        onClick={onRetry}
                        disabled={timeLeft > 0}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {timeLeft > 0 ? (
                            <span>Try again in {timeLeft}s</span>
                        ) : (
                            <>
                                <RefreshCw size={14} />
                                <span>Try Again</span>
                            </>
                        )}
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="shrink-0 rounded-full p-1 text-white/40 hover:bg-white/10 hover:text-white"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    );
}
