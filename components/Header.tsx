"use client";

import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/Nav";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthProvider";

export default function Header() {
    const { user } = useAuth();
    const [visible, setVisible] = useState(true);
    const [isTop, setIsTop] = useState(true);

    const lastScrollY = useRef(0);
    const idleTimer = useRef<NodeJS.Timeout | null>(null);

    // Scroll Logic
    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Check if at top
            setIsTop(currentScrollY < 10);

            if (!user) {
                // Always visible if not logged in (standard sticky behavior)
                setVisible(true);
            } else {
                // Logged In Logic
                if (currentScrollY < 10) {
                    setVisible(true); // Always show at top
                } else if (currentScrollY > lastScrollY.current) {
                    // Scrolling Down -> Hide
                    setVisible(false);
                } else {
                    // Scrolling Up -> Show
                    setVisible(true);
                }
            }

            lastScrollY.current = currentScrollY;
            resetIdleTimer();
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, [user]);

    // Idle Logic (Only for logged in users)
    const resetIdleTimer = () => {
        if (!user) return;

        if (idleTimer.current) clearTimeout(idleTimer.current);

        // If we are not at the top, start timer to hide
        if (window.scrollY > 10) {
            idleTimer.current = setTimeout(() => {
                setVisible(false);
            }, 3000);
        }
    };

    useEffect(() => {
        if (user) {
            window.addEventListener("mousemove", resetIdleTimer);
            window.addEventListener("touchstart", resetIdleTimer);
            resetIdleTimer(); // Start initial timer
        }

        return () => {
            if (idleTimer.current) clearTimeout(idleTimer.current);
            window.removeEventListener("mousemove", resetIdleTimer);
            window.removeEventListener("touchstart", resetIdleTimer);
        };
    }, [user]);


    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 bg-black/90 border-b border-white/10 backdrop-blur-md transition-transform duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'}`}
        >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
                {/* Logo / Brand */}
                <Link href="/" className="flex min-w-0 items-center gap-3">
                    <Image
                        src="/logo-symbol.png"
                        alt="AI Skills Studio"
                        width={36}
                        height={36}
                        priority
                        className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                    />

                    <span className="min-w-0 whitespace-nowrap truncate text-lg font-bold tracking-tight sm:text-xl">
                        <span className="text-lime-400">AI Skills</span>{" "}
                        <span className="text-white">Studio</span>
                    </span>
                </Link>

                {/* Navigation */}
                <div className="shrink-0">
                    <Nav />
                </div>
            </div>
        </header>
    );
}
