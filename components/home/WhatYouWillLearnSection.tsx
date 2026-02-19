"use client";

import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";
import { Users, Zap, LayoutTemplate } from "lucide-react";

export default function WhatYouWillLearnSection() {
    const { user } = useAuth();

    // Cards data
    const cards = [
        {
            icon: <Users className="h-8 w-8 text-[#B7FF00]" />,
            title: "Get More Customers",
            description: "Create posts, offers, and messages that bring people in."
        },
        {
            icon: <LayoutTemplate className="h-8 w-8 text-[#B7FF00]" />,
            title: "Create Content Faster",
            description: "Make flyers, captions, emails, and videos in less time."
        },
        {
            icon: <Zap className="h-8 w-8 text-[#B7FF00]" />,
            title: "Run Your Business Smarter",
            description: "Save hours with easy AI workflows for everyday tasks."
        }
    ];

    return (
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold md:text-5xl text-foreground mb-6">
                    What You’ll Learn
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
                        <h3 className="text-xl font-bold text-foreground mb-3">
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
                    className="inline-flex items-center justify-center rounded-md bg-[#B7FF00] px-8 py-4 text-base font-bold text-black hover:opacity-90 transition-opacity"
                >
                    Sign Up Free and Start Now
                </Link>
            </div>
        </section>
    );
}
