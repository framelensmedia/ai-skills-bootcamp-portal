
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { Plus, Folder, MessageSquare, ChevronDown, ChevronRight, MoreHorizontal, Trash, FolderPlus } from "lucide-react";

interface ChatSession {
    id: string;
    title: string;
    folder_id: string | null;
    updated_at: string;
}

interface Folder {
    id: string;
    name: string;
}

interface StudioSidebarProps {
    activeChatId: string | null;
    onChatSelect: (chatId: string) => void;
    onNewChat: () => void;
    className?: string;
}

export default function StudioSidebar({ activeChatId, onChatSelect, onNewChat, className = "" }: StudioSidebarProps) {
    const router = useRouter();
    const supabase = createSupabaseBrowserClient();

    const [chats, setChats] = useState<ChatSession[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();

        // Subscribe to changes (simple polling for now or just reload on events)
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    async function fetchData() {
        const [cRes, fRes] = await Promise.all([
            supabase.from("notebook_chats").select("*").order("updated_at", { ascending: false }),
            supabase.from("notebook_folders").select("*").order("name", { ascending: true })
        ]);

        if (cRes.data) setChats(cRes.data);
        if (fRes.data) setFolders(fRes.data);
        setLoading(false);
    }

    async function createFolder() {
        const name = prompt("New Folder Name:");
        if (!name) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from("notebook_folders")
            .insert({ name, user_id: user.id })
            .select()
            .single();

        if (data) setFolders(prev => [...prev, data]);
    }

    async function moveChatToFolder(chatId: string, folderId: string | null) {
        await supabase.from("notebook_chats").update({ folder_id: folderId }).eq("id", chatId);
        setChats(prev => prev.map(c => c.id === chatId ? { ...c, folder_id: folderId } : c));
    }

    async function deleteChat(chatId: string) {
        if (!confirm("Delete this chat?")) return;
        await supabase.from("notebook_chats").delete().eq("id", chatId);
        setChats(prev => prev.filter(c => c.id !== chatId));
        if (activeChatId === chatId) onNewChat();
    }

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Grouping logic
    const unorganizedChats = chats.filter(c => !c.folder_id);

    return (
        <div className={`bg-[#111] border-r border-gray-800 flex flex-col h-full ${className}`}>

            {/* New Chat Button */}
            <div className="p-4 border-b border-gray-800">
                <button
                    onClick={onNewChat}
                    className="w-full bg-white text-black py-2.5 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                    <Plus size={16} /> New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-800">

                {/* 1. Folders Section */}
                <div className="mb-4">
                    <div className="flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        <span>Folders</span>
                        <button onClick={createFolder} className="hover:text-white"><FolderPlus size={14} /></button>
                    </div>

                    {folders.map(folder => {
                        const folderChats = chats.filter(c => c.folder_id === folder.id);
                        const isExpanded = expandedFolders.has(folder.id);

                        return (
                            <div key={folder.id} className="mb-1">
                                <div
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-900 cursor-pointer text-gray-300 group"
                                    onClick={() => toggleFolder(folder.id)}
                                >
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                    <Folder size={14} className="text-blue-500" />
                                    <span className="flex-1 truncate text-sm">{folder.name}</span>
                                    <span className="text-xs text-gray-600">{folderChats.length}</span>
                                </div>

                                {isExpanded && (
                                    <div className="ml-4 pl-2 border-l border-gray-800 mt-1 space-y-0.5">
                                        {folderChats.map(chat => (
                                            <ChatItem
                                                key={chat.id}
                                                chat={chat}
                                                isActive={activeChatId === chat.id}
                                                onSelect={() => onChatSelect(chat.id)}
                                                onDelete={() => deleteChat(chat.id)}
                                                onMove={(fid) => moveChatToFolder(chat.id, fid)}
                                                folders={folders}
                                            />
                                        ))}
                                        {folderChats.length === 0 && (
                                            <div className="px-2 py-2 text-xs text-gray-600 italic">Empty folder</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* 2. Unorganized Chats */}
                <div className="mt-2">
                    <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Recent Chats
                    </div>
                    {unorganizedChats.map(chat => (
                        <ChatItem
                            key={chat.id}
                            chat={chat}
                            isActive={activeChatId === chat.id}
                            onSelect={() => onChatSelect(chat.id)}
                            onDelete={() => deleteChat(chat.id)}
                            onMove={(fid) => moveChatToFolder(chat.id, fid)}
                            folders={folders}
                        />
                    ))}
                </div>

            </div>
        </div>
    );
}

function ChatItem({ chat, isActive, onSelect, onDelete, onMove, folders }: any) {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <div className={`group relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${isActive ? "bg-gray-800 text-white" : "text-gray-400 hover:bg-gray-900 hover:text-gray-200"}`}>
            <div className="flex-1 truncate flex items-center gap-2" onClick={onSelect}>
                <MessageSquare size={14} className="opacity-50 shrink-0" />
                <span className="truncate">{chat.title}</span>
            </div>

            <div className="relative">
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                    className={`p-1 rounded hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity ${menuOpen ? "opacity-100 bg-gray-700" : ""}`}
                >
                    <MoreHorizontal size={14} />
                </button>

                {menuOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-6 w-48 bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden py-1">
                            <div className="px-3 py-1.5 text-xs text-gray-500 font-semibold">Move to...</div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onMove(null); setMenuOpen(false); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-gray-800 text-gray-300 flex items-center gap-2"
                            >
                                <MessageSquare size={12} /> Recent (No Folder)
                            </button>
                            {folders.map((f: any) => (
                                <button
                                    key={f.id}
                                    onClick={(e) => { e.stopPropagation(); onMove(f.id); setMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-800 text-gray-300 flex items-center gap-2"
                                >
                                    <Folder size={12} /> {f.name}
                                </button>
                            ))}
                            <div className="border-t border-gray-700 my-1"></div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/30 text-red-400 flex items-center gap-2"
                            >
                                <Trash size={12} /> Delete Chat
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
