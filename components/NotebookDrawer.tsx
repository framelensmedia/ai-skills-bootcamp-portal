
"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { ChevronRight, ChevronDown, Folder, FileText, Plus, X, Save, ArrowLeft, MoreHorizontal, Trash } from "lucide-react";

interface Note {
    id: string;
    title: string;
    content: string;
    folder_id: string | null;
    updated_at: string;
}

interface Folder {
    id: string;
    name: string;
    parent_id: string | null;
}

interface NotebookDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    pendingSaveContent?: string; // Content from chat to save
    onSaveContentHandled?: () => void; // Clear pending content
}

export default function NotebookDrawer({ isOpen, onClose, pendingSaveContent, onSaveContentHandled }: NotebookDrawerProps) {
    const supabase = createSupabaseBrowserClient();

    // Data
    const [folders, setFolders] = useState<Folder[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);

    // Navigation State
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [activeNote, setActiveNote] = useState<Note | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // Editor State
    const [editorTitle, setEditorTitle] = useState("");
    const [editorContent, setEditorContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    // Handle "Save to Note" external trigger
    useEffect(() => {
        if (pendingSaveContent && !activeNote) {
            // If no note open, create new? Or prompt?
            // For now, let's open a "New Note" UI with the content pre-filled
            setActiveNote({ id: "new", title: "New AI Strategy", content: pendingSaveContent, folder_id: activeFolderId, updated_at: "" });
            setEditorTitle("New Suggestion");
            setEditorContent(pendingSaveContent);
            if (onSaveContentHandled) onSaveContentHandled();
        } else if (pendingSaveContent && activeNote) {
            // Append to current note?
            setEditorContent(prev => prev + "\n\n" + pendingSaveContent);
            if (onSaveContentHandled) onSaveContentHandled();
        }
    }, [pendingSaveContent, activeNote, activeFolderId]);


    async function fetchData() {
        setLoading(true);
        const [fRes, nRes] = await Promise.all([
            fetch("/api/notebook/folders").then(r => r.json()),
            fetch("/api/notebook/notes").then(r => r.json())
        ]);

        if (fRes.folders) setFolders(fRes.folders);
        if (nRes.notes) setNotes(nRes.notes);
        setLoading(false);
    }

    // --- Actions ---

    async function handleSaveNote() {
        if (!editorTitle.trim()) return;
        setIsSaving(true);

        const payload = {
            id: activeNote?.id === "new" ? undefined : activeNote?.id,
            title: editorTitle,
            content: editorContent,
            folder_id: activeFolderId
        };

        try {
            const res = await fetch("/api/notebook/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.note) {
                // Update local state
                if (activeNote?.id === "new") {
                    setNotes(prev => [data.note, ...prev]);
                    setActiveNote(data.note);
                } else {
                    setNotes(prev => prev.map(n => n.id === data.note.id ? data.note : n));
                }
            }
        } catch (e) {
            console.error("Save failed", e);
        } finally {
            setIsSaving(false);
        }
    }

    async function createFolder() {
        const name = prompt("Folder Name:");
        if (!name) return;

        const res = await fetch("/api/notebook/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, parent_id: activeFolderId })
        });
        const data = await res.json();
        if (data.folder) {
            setFolders(prev => [...prev, data.folder]);
        }
    }

    async function deleteNote(id: string) {
        if (!confirm("Delete this note?")) return;

        await fetch(`/api/notebook/notes/${id}`, { method: "DELETE" });
        setNotes(prev => prev.filter(n => n.id !== id));
        if (activeNote?.id === id) {
            setActiveNote(null);
        }
    }


    // --- Render Helpers ---

    const toggleFolder = (id: string) => {
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedFolders(next);
    };

    const openNote = (note: Note) => {
        setActiveNote(note);
        setEditorTitle(note.title);
        setEditorContent(note.content);
    };

    const createNewNote = () => {
        setActiveNote({ id: "new", title: "", content: "", folder_id: activeFolderId, updated_at: "" });
        setEditorTitle("");
        setEditorContent("");
    };

    // Filter items based on active folder (simple 1-level for now)
    // If activeFolderId is null, show root items? Or all? Let's show root.
    const currentFolders = folders.filter(f => f.parent_id === activeFolderId);
    const currentNotes = notes.filter(n => n.folder_id === activeFolderId);


    return (
        <div className={`fixed inset-y-0 right-0 w-96 bg-[#111] border-l border-gray-800 transform transition-transform duration-300 shadow-2xl z-50 flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}>

            {/* Header */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-4 bg-black/50">
                <div className="font-bold flex items-center gap-2">
                    {activeFolderId !== null && (
                        <button onClick={() => setActiveFolderId(null)} className="hover:bg-gray-800 p-1 rounded">
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <span>{activeFolderId ? folders.find(f => f.id === activeFolderId)?.name : "Notebook"}</span>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden flex flex-col">

                {activeNote ? (
                    // EDITOR VIEW
                    <div className="flex-1 flex flex-col h-full bg-[#0a0a0a]">
                        <div className="p-4 border-b border-gray-800 flex gap-2">
                            <button onClick={() => setActiveNote(null)} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400">
                                <ArrowLeft size={18} />
                            </button>
                            <input
                                value={editorTitle}
                                onChange={e => setEditorTitle(e.target.value)}
                                placeholder="Note Title..."
                                className="flex-1 bg-transparent text-lg font-bold focus:outline-none placeholder-gray-600"
                            />
                            <button onClick={handleSaveNote} disabled={isSaving} className="text-purple-500 hover:text-purple-400 disabled:opacity-50">
                                <Save size={20} />
                            </button>
                        </div>
                        <textarea
                            value={editorContent}
                            onChange={e => setEditorContent(e.target.value)}
                            placeholder="Start typing..."
                            className="flex-1 w-full bg-transparent p-4 resize-none focus:outline-none font-mono text-sm leading-relaxed text-gray-300"
                        />
                    </div>
                ) : (
                    // EXPLORER VIEW
                    <div className="flex-1 overflow-y-auto p-2">
                        {loading && <div className="text-center p-4 text-gray-500">Loading...</div>}

                        {/* Folders */}
                        {currentFolders.map(folder => (
                            <div key={folder.id}
                                onClick={() => setActiveFolderId(folder.id)}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-900 cursor-pointer group"
                            >
                                <Folder size={18} className="text-blue-400 fill-blue-900/30" />
                                <span className="flex-1 truncate text-sm">{folder.name}</span>
                                <ChevronRight size={14} className="text-gray-600 group-hover:text-white" />
                            </div>
                        ))}

                        {/* Notes */}
                        {currentNotes.map(note => (
                            <div key={note.id}
                                onClick={() => openNote(note)}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-900 cursor-pointer group"
                            >
                                <FileText size={18} className="text-gray-500" />
                                <div className="flex-1 truncate">
                                    <div className="text-sm text-gray-200 truncate">{note.title}</div>
                                    <div className="text-xs text-gray-500 truncate">{note.content.substring(0, 30)}</div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
                                >
                                    <Trash size={14} />
                                </button>
                            </div>
                        ))}

                        {/* Empty State */}
                        {!loading && currentFolders.length === 0 && currentNotes.length === 0 && (
                            <div className="text-center py-10 text-gray-600 text-sm">
                                Empty folder
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Toolbar (Only in Explorer) */}
            {!activeNote && (
                <div className="p-4 border-t border-gray-800 grid grid-cols-2 gap-3">
                    <button onClick={createFolder} className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 py-2 rounded-lg text-sm text-gray-300">
                        <Folder size={16} /> New Folder
                    </button>
                    <button onClick={createNewNote} className="flex items-center justify-center gap-2 bg-purple-900/50 hover:bg-purple-900 py-2 rounded-lg text-sm text-purple-200">
                        <Plus size={16} /> New Note
                    </button>
                </div>
            )}
        </div>
    );
}
