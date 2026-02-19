"use client";

import { useEffect, useRef } from "react";
import { driver, DriveStep } from "driver.js";
import { useSearchParams } from "next/navigation";
import "driver.js/dist/driver.css";
import { useAuth } from "@/context/AuthProvider";

interface TourGuideProps {
    tourId: string;
    steps: DriveStep[];
    runOnMount?: boolean;
    startTrigger?: any; // Change in this prop triggers tour
    onComplete?: () => void;
    triggerParamName?: string; // e.g. "feed" -> ?tour=feed
    requireAuth?: boolean;
}

export default function TourGuide({ tourId, steps, runOnMount = true, startTrigger, onComplete, triggerParamName, requireAuth = true }: TourGuideProps) {
    const driverObj = useRef<any>(null);
    const searchParams = useSearchParams();
    const tourParam = searchParams.get("tour");
    const { user, initialized } = useAuth();
    const loading = !initialized;

    useEffect(() => {
        driverObj.current = driver({
            showProgress: true,
            animate: true,
            doneBtnText: "Done",
            nextBtnText: "Next",
            prevBtnText: "Back",
            steps: steps,
            onDestroyed: () => {
                // Mark as seen in localStorage
                localStorage.setItem(`tour_seen_${tourId}`, "true");
                if (onComplete) onComplete();
            }
        });
    }, [steps, tourId, onComplete]);

    useEffect(() => {
        if (loading) return;
        if (requireAuth && !user) return;

        const hasSeen = localStorage.getItem(`tour_seen_${tourId}`);
        const forceRun = triggerParamName && tourParam === triggerParamName;

        // If we want to force debug, we can comment out the check
        if ((!hasSeen && runOnMount) || forceRun) {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                driverObj.current?.drive();
            }, 1500);
        }
    }, [tourId, runOnMount, tourParam, triggerParamName, user, loading, requireAuth]);

    useEffect(() => {
        if (startTrigger) {
            if (requireAuth && !user) return;
            driverObj.current?.drive();
        }
    }, [startTrigger, user, requireAuth]);

    return null; // Logic only
}
