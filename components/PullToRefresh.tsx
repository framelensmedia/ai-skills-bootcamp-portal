"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

export default function PullToRefresh() {
    const router = useRouter();
    const [startY, setStartY] = useState(0);
    const [currentY, setCurrentY] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [pulling, setPulling] = useState(false);

    // Threshold to trigger refresh (pixels)
    const THRESHOLD = 120;

    useEffect(() => {
        // Only active on mobile / PWA
        // We can check if touch is supported
        if (typeof window === "undefined" || !("ontouchstart" in window)) return;

        const handleTouchStart = (e: TouchEvent) => {
            if (window.scrollY === 0) {
                setStartY(e.touches[0].clientY);
                setPulling(true);
            } else {
                setPulling(false);
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!pulling || refreshing) return;

            const y = e.touches[0].clientY;
            const diff = y - startY;

            // Only track if pulling down and near top
            if (diff > 0 && window.scrollY <= 0) {
                // Add resistance/dampening
                setCurrentY(diff * 0.5);

                // Prevent default only if we are effectively "pulling to refresh"
                // so we don't interfere with normal scrolling if they scroll back up
                if (diff > 10) {
                    // Optional: e.preventDefault(); 
                    // Note: e.preventDefault() on touchmove is often treated as passive. 
                    // We might rely on overscroll-behavior in CSS.
                }
            } else {
                setCurrentY(0);
            }
        };

        const handleTouchEnd = () => {
            if (!pulling || refreshing) return;

            if (currentY > THRESHOLD * 0.5) { // Threshold reached (after dampening)
                setRefreshing(true);
                setCurrentY(60); // Snap to loading position

                // Trigger generic refresh
                window.location.reload();

                // Fallback if reload takes time or fails
                setTimeout(() => {
                    setRefreshing(false);
                    setCurrentY(0);
                }, 2000);
            } else {
                // Snap back
                setCurrentY(0);
                setRefreshing(false);
            }
            setPulling(false);
        };

        window.addEventListener("touchstart", handleTouchStart, { passive: true });
        window.addEventListener("touchmove", handleTouchMove, { passive: false }); // non-passive to allow preventDefault if needed, but here we just track
        window.addEventListener("touchend", handleTouchEnd);

        return () => {
            window.removeEventListener("touchstart", handleTouchStart);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleTouchEnd);
        };
    }, [startY, pulling, refreshing, currentY]);

    // Don't render anything if not interacting
    if (currentY === 0 && !refreshing) return null;

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none"
            style={{
                transform: `translateY(${currentY - 60}px)`, // Start hidden above
                transition: pulling ? 'none' : 'transform 0.3s ease-out'
            }}
        >
            <div className="bg-black/80 backdrop-blur-md rounded-full p-2 border border-white/10 shadow-lg text-[#B7FF00] mt-4 flex items-center gap-2">
                {refreshing ? (
                    <>
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-xs font-bold pr-1">Reloading...</span>
                    </>
                ) : (
                    <RefreshCw size={20} style={{ transform: `rotate(${currentY * 2}deg)` }} />
                )}
            </div>
        </div>
    );
}
