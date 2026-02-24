"use client";

import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";
import { Users, Zap, LayoutTemplate } from "lucide-react";
import { trackEvent } from "@/lib/gtm";

export default function WhatYouWillLearnSection() {
    const { user } = useAuth();

    // Cards data
    const cards = [
        {
            icon: <Users className="h-8 w-8 text-[#B7FF00]" />,
            title: "Fill Your Schedule",
            description: "Create daily social posts and offers that make your phone ring."
        },
        {
            icon: <LayoutTemplate className="h-8 w-8 text-[#B7FF00]" />,
            title: "No Design Experience Needed",
            description: "Stop paying expensive agencies. Just type your business name, pick a template, and hit go."
        },
        {
            icon: <Zap className="h-8 w-8 text-[#B7FF00]" />,
            title: "Save 10 Hours a Week",
            description: "Let our AI handle the heavy lifting while you focus on running your business."
        }
    ];

    return (
        <section className="mx-auto max-w-6xl px-4 pt-16 md:pt-24 pb-12">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold md:text-3xl lg:text-4xl text-foreground mb-6 tracking-tight">
                    Marketing That Actually Brings People Through The Door.
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                    Simple AI skills you can use right away to grow your business.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                {cards.map((card, index) => (
                    <div key={index} className="bg-card border border-border rounded-2xl p-8 hover:border-[#B7FF00]/30 transition-colors duration-300">
                        <div className="mb-6 p-4 bg-[#B7FF00]/10 rounded-2xl w-fit">
                            {card.icon}
                        </div>
                        <h3 className="text-lg lg:text-[19px] xl:text-xl font-bold text-foreground mb-3 tracking-tight">
                            {card.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                            {card.description}
                        </p>
                    </div>
                ))}
            </div>

            <div className="flex justify-center">
                <Link
                    href={user ? "/prompts" : "/signup"}
                    onClick={() => {
                        if (!user) trackEvent("cta_click_signup_free", { section: "benefits", label: "Sign Up Free and Start Now" });
                        trackEvent("cta_click_start_now", { section: "benefits", label: "Sign Up Free and Start Now" });
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-[#B7FF00] px-8 py-4 text-base font-bold text-black hover:opacity-90 transition-opacity"
                >
                    Sign Up Free and Start Now
                </Link>
            </div>
        </section>
    );
}
