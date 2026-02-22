"use client";

import { MessageSquare, ArrowUpRight } from "lucide-react";

type DiscordVipWidgetProps = {
    hasProAccess: boolean;
    discordUserId?: string | null;
};

export default function DiscordVipWidget({ hasProAccess, discordUserId }: DiscordVipWidgetProps) {
    if (!hasProAccess) return null; // Only show for PRO members

    const isLinked = !!discordUserId;

    return (
        <div className="rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/10 p-5 mb-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#5865F2]">
                <MessageSquare size={20} className="text-white" />
            </div>
            <h3 className="font-bold text-white mb-2">Elite Mastermind Discord</h3>

            {isLinked ? (
                <>
                    <p className="text-sm text-white/70 font-medium mb-4">
                        You're in! You have full access to our private VIP community.
                    </p>
                    <a
                        href="discord://"
                        onClick={(e) => {
                            // Fallback to web app if deep link fails
                            setTimeout(() => {
                                window.location.href = "https://discord.com/channels/@me";
                            }, 500);
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] py-2.5 text-sm font-bold text-white hover:bg-[#5865F2]/90 transition"
                    >
                        Open Discord App <ArrowUpRight size={16} />
                    </a>
                </>
            ) : (
                <>
                    <p className="text-sm text-white/70 font-medium mb-4">
                        Connect your Discord account to get instant access to our private VIP channels.
                    </p>
                    <a
                        href="/api/discord/auth"
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#5865F2] py-2.5 text-sm font-bold text-white hover:bg-[#5865F2]/90 transition"
                    >
                        Connect Discord <ArrowUpRight size={16} />
                    </a>
                </>
            )}
        </div>
    );
}
