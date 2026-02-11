
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Menu, Book } from "lucide-react";

import NotebookDrawer from "@/components/NotebookDrawer";
import StudioSidebar from "@/components/studio/StudioSidebar";
import StudioChatInterface from "@/components/studio/StudioChatInterface";

import { Suspense } from "react";

function StudioChatContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const chatId = searchParams.get("id");

    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [notebookOpen, setNotebookOpen] = useState(false);
    const [pendingNoteContent, setPendingNoteContent] = useState<string | undefined>(undefined);

    // Handlers
    const handleNewChat = () => {
        router.push("/studio/chat");
    };

    const handleChatSelect = (id: string) => {
        router.push(`/studio/chat?id=${id}`);
        // If on mobile, close sidebar? (Optional)
    };

    const handleNewChatCreated = (id: string) => {
        window.history.replaceState(null, "", `/studio/chat?id=${id}`);
    };

    const handleSaveToNote = (content: string) => {
        setPendingNoteContent(content);
        setNotebookOpen(true);
    };

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-black text-white">

            {/* --- SIDEBAR (History + Folders) --- */}
            <div className={`${sidebarOpen ? "w-64" : "w-0"} transition-all duration-300 flex flex-col shrink-0 overflow-hidden`}>
                <StudioSidebar
                    activeChatId={chatId}
                    onChatSelect={handleChatSelect}
                    onNewChat={handleNewChat}
                    className="h-full border-r border-[#222]"
                />
            </div>

            {/* --- MAIN CHAT AREA --- */}
            <div className="flex-1 flex flex-col relative h-full min-w-0">

                {/* Header */}
                <div className="h-12 border-b border-gray-800 flex items-center px-4 justify-between bg-black/50 backdrop-blur z-10 shrink-0">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white shrink-0">
                            <Menu size={20} />
                        </button>
                        <span className="font-semibold text-sm text-gray-200 truncate">
                            AI Strategist
                        </span>
                    </div>
                    <button
                        onClick={() => setNotebookOpen(!notebookOpen)}
                        className={`text-sm flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors shrink-0 ${notebookOpen ? "bg-purple-900/30 border-purple-500 text-purple-400" : "border-gray-800 text-gray-400 hover:text-white"}`}
                    >
                        <Book size={16} /> Notebook
                    </button>
                </div>

                {/* Interface */}
                <StudioChatInterface
                    chatId={chatId}
                    onNewChatId={handleNewChatCreated}
                    onSaveToNote={handleSaveToNote}
                    className="flex-1 overflow-hidden"
                />
            </div>

            {/* --- RIGHT PANEL (Notebook Drawer) --- */}
            <NotebookDrawer
                isOpen={notebookOpen}
                onClose={() => setNotebookOpen(false)}
                pendingSaveContent={pendingNoteContent}
                onSaveContentHandled={() => setPendingNoteContent(undefined)}
            />

        </div>
    );
}

export default function StudioChatPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center bg-black text-white">Loading Chat...</div>}>
            <StudioChatContent />
        </Suspense>
    );
}
