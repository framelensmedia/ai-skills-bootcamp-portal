"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function PWABackButton() {
    const router = useRouter();
    const pathname = usePathname();
    const [isPWA, setIsPWA] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);

    useEffect(() => {
        // Detect if running in standalone mode (PWA)
        const checkPWA = () => {
            return (
                window.matchMedia("(display-mode: standalone)").matches ||
                (window.navigator as any).standalone === true ||
                document.referrer.includes("android-app://")
            );
        };

        setIsPWA(checkPWA());

        // Simple heuristic for back navigation:
        // We can go back if we're not on the home page or a root dashboard page
        // A more robust solution would involve tracking history stack, but this covers 90% of cases
        const rootPaths = ["/", "/dashboard", "/feed", "/learning", "/settings", "/login"];
        setCanGoBack(!rootPaths.includes(pathname));
    }, [pathname]);

    if (!isPWA || !canGoBack) return null;

    return (
        <button
            onClick={() => router.back()}
            className="fixed top-[env(safe-area-inset-top,16px)] left-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-full bg-black/50 p-2 text-white backdrop-blur-md transition-all hover:bg-black/70 active:scale-95 shadow-[0_4px_12px_rgba(0,0,0,0.5)] border border-white/10 md:hidden"
            aria-label="Go back"
        >
            <ChevronLeft size={24} />
        </button>
    );
}
