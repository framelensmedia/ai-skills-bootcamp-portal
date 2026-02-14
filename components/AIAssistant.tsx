
"use client";

import { useState, useEffect, useRef, Suspense, cloneElement } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Minimize2, Sparkles, Menu, X } from "lucide-react";
import StudioSidebar from "@/components/studio/StudioSidebar";
import StudioChatInterface from "@/components/studio/StudioChatInterface";
import OnboardingChat from "@/components/OnboardingChat";

interface AIAssistantProps {
    onboardingMode?: boolean;
    onboardingContent?: React.ReactNode;
}

function AIAssistantContent({ onboardingMode, onboardingContent }: AIAssistantProps) {
    const supabase = createSupabaseBrowserClient();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    // Context
    const folderId = searchParams.get("folderId");
    const isNotebook = pathname?.includes("/studio/notebook");
    const isStudioChat = pathname?.includes("/studio/chat");
    const isOnboardingPage = pathname === "/onboarding";

    // Mode State
    const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false); // Default to false for pop-up feel

    // Determine Setup Mode
    // We treat it as setup mode if:
    // 1. Explicit prop
    // 2. Onboarding Page
    // 3. User's profile says incomplete (and we are not on the dashboard/community, or acceptable pages)
    // Actually, user wants it EVERYWHERE if incomplete.
    const isSetupMode = onboardingMode || isOnboardingPage || onboardingIncomplete;

    // UI States
    // Initialize open state based on setup mode
    const [isOpen, setIsOpen] = useState(isSetupMode ? true : false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isIdle, setIsIdle] = useState(false);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    // Check Onboarding Status (for new flow where we land on /community)
    useEffect(() => {
        const checkOnboarding = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("user_id", user.id).single();
                if (profile && !profile.onboarding_completed) {
                    setOnboardingIncomplete(true);
                    // Force open if not already open (and presumably not manually closed in this session, though we don't track that yet)
                    // Since isOpen is initialized once, we need to update it here.
                    setIsOpen(true);
                }
            }
        };
        // Only run check if not already explicitly in setup mode via props/url
        if (!onboardingMode && !isOnboardingPage) {
            checkOnboarding();
        }
    }, [onboardingMode, isOnboardingPage, supabase]);


    const activeContent = onboardingContent || (isSetupMode ? <OnboardingChat /> : null);

    // Start Expanded/Open if Setup Mode detected after mount
    useEffect(() => {
        if (isSetupMode && !isOpen) {
            // Optional: Force open?
            // If user minimizes, we don't want to pop open again instantly on re-render.
            // But valid initial state transition (false -> true) is handled in the checkOnboarding effect for the "discovery" moment.
        }
    }, [isSetupMode]);

    // Don't show on the actual chat page to avoid duplicate UIs (unless onboarding)
    if (isStudioChat && !isSetupMode) return null;

    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-hide tab logic (disabled in onboarding mode)
    useEffect(() => {
        if (isSetupMode) return;
        const timer = setTimeout(() => setIsIdle(true), 3000);
        return () => clearTimeout(timer);
    }, [isSetupMode]);

    const handleMouseEnter = () => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        setIsIdle(false);
    };

    const handleMouseLeave = () => {
        idleTimerRef.current = setTimeout(() => setIsIdle(true), 3000);
    };

    const handleOpen = () => {
        setIsOpen(true);
        setIsExpanded(false); // Default to "Center Modal" view
        if (isIdle) setIsIdle(false);
    };

    const handleMinimize = () => {
        setIsOpen(false);
    };

    const handleNewChat = () => {
        setActiveChatId(null);
    };

    // Header title
    const headerTitle = isSetupMode
        ? "Account Setup"
        : (folderId && isNotebook ? "AI Strategist" : "Ask AI");

    return (
        <>
            {/* --- IMMERSIVE CHAT OVERLAY --- */}
            <div
                className={`fixed z-[100] flex flex-col transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
                    } ${isExpanded
                        ? "inset-0 bg-black flex overflow-hidden" // Full Screen (App Mode)
                        : "inset-[5%] md:inset-[10%] rounded-[10px] bg-black/95 backdrop-blur-2xl border border-[#B7FF00]/40 shadow-[0_0_50px_rgba(183,255,0,0.25)] flex overflow-hidden" // Modal Mode (Glow)
                    }`}
            >
                {/* Header / Layout Container */}
                <div className="flex h-full w-full overflow-hidden relative">

                    {/* SIDEBAR (Hidden in onboarding mode) */}
                    {!onboardingMode && !isSetupMode && (
                        <div className={`absolute inset-y-0 left-0 z-20 bg-black/90 backdrop-blur-xl border-r border-white/10 transition-all duration-300 flex flex-col overflow-hidden ${showSidebar ? "w-64 translate-x-0" : "w-64 -translate-x-full"}`}>
                            <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 font-bold text-sm text-gray-300">
                                <span>Recent Chats</span>
                                <button onClick={() => setShowSidebar(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
                            </div>
                            <StudioSidebar
                                activeChatId={activeChatId}
                                onChatSelect={(id) => { setActiveChatId(id); setShowSidebar(false); }}
                                onNewChat={() => { handleNewChat(); setShowSidebar(false); }}
                                className="flex-1 bg-transparent" // Override background
                            />
                        </div>
                    )}

                    {/* MAIN CONTENT */}
                    <div className="flex-1 flex flex-col min-w-0 bg-transparent relative z-10 opacity-100 transition-opacity">

                        {/* Custom Header for Pop-up */}
                        <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                                {!isSetupMode && (
                                    <button
                                        onClick={() => setShowSidebar(!showSidebar)}
                                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                    >
                                        <Menu size={20} />
                                    </button>
                                )}
                                <span className="font-semibold text-gray-200 flex items-center gap-2">
                                    <Sparkles size={16} className="text-[#B7FF00]" />
                                    {headerTitle}
                                </span>
                            </div>
                            <button
                                onClick={handleMinimize}
                                className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                                title="Minimize"
                            >
                                <Minimize2 size={18} />
                            </button>
                        </div>

                        {/* Chat Interface — swap content based on mode */}
                        <div className="flex-1 overflow-hidden relative">
                            {isSetupMode && activeContent ? (
                                <div className="h-full">
                                    {typeof activeContent === 'object' && activeContent !== null
                                        ? cloneElement(activeContent as React.ReactElement<any>, { onInputFocus: () => setIsExpanded(true) })
                                        : activeContent
                                    }
                                </div>
                            ) : (
                                <StudioChatInterface
                                    chatId={activeChatId}
                                    onNewChatId={setActiveChatId}
                                    className="h-full"
                                    placeholderText={folderId && isNotebook ? "Ask about your project..." : "What can I create for you today?"}
                                    onInputFocus={() => setIsExpanded(true)}
                                />
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* --- MINIMIZED BUTTON --- */}
            <div
                className={`fixed bottom-0 right-0 z-[90] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${!isOpen ? "translate-y-0" : "translate-y-20 opacity-0 pointer-events-none"
                    }`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <button
                    onClick={handleOpen}
                    className={`group flex items-center gap-0 rounded-l-2xl rounded-r-none bg-[#B7FF00] backdrop-blur-md pl-4 pr-4 py-3 shadow-[0_0_20px_rgba(183,255,0,0.2)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isIdle
                        ? "translate-x-[calc(100%-3.5rem)] opacity-50 hover:translate-x-0 hover:opacity-100"
                        : "translate-x-0 opacity-100"
                        }`}
                >
                    <Sparkles size={20} className="text-black fill-current shrink-0 mr-3" />

                    <div className={`overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] whitespace-nowrap ${isIdle ? "w-0 opacity-0" : "w-auto opacity-100 pr-4"
                        }`}>
                        <span className="text-sm font-bold text-black tracking-wide">
                            {isSetupMode ? "Continue Setup" : (folderId && isNotebook ? "AI Strategist" : "Ask AI")}
                        </span>
                    </div>
                </button>
            </div>
        </>
    );
}

export default function AIAssistant({ onboardingMode, onboardingContent }: AIAssistantProps = {}) {
    return (
        <Suspense fallback={null}>
            <AIAssistantContent onboardingMode={onboardingMode} onboardingContent={onboardingContent} />
        </Suspense>
    );
}
