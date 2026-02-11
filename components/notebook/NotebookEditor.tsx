import { useState, useEffect } from "react";
import { NotebookNote } from "@/types/notebook";
import { Save, Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotebookEditorProps {
    note: NotebookNote | null;
    onUpdate: (id: string, updates: Partial<NotebookNote>) => void;
}

export function NotebookEditor({ note, onUpdate }: NotebookEditorProps) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    // Sync state when note changes
    useEffect(() => {
        if (note) {
            setTitle(note.title);
            setContent(note.content || "");
        } else {
            setTitle("");
            setContent("");
        }
    }, [note]);

    // Debounced save
    useEffect(() => {
        if (!note) return;
        const timeout = setTimeout(() => {
            if (title !== note.title || content !== note.content) {
                onUpdate(note.id, { title, content });
            }
        }, 1000); // Auto-save after 1s idle
        return () => clearTimeout(timeout);
    }, [title, content, note, onUpdate]);

    if (!note) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-400 bg-white dark:bg-black/20">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                    <Save className="w-8 h-8 opacity-50" />
                </div>
                <p>Select a note to edit or start a new strategy.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-white dark:bg-black/20">
            {/* Toolkit */}
            <div className="px-8 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="text-xs text-zinc-400">
                    Last edited {new Date(note.updated_at).toLocaleTimeString()}
                </div>
                <button
                    onClick={() => onUpdate(note.id, { is_pinned: !note.is_pinned })}
                    className={cn(
                        "p-2 rounded-md transition-colors",
                        note.is_pinned ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
                    )}
                    title={note.is_pinned ? "Unpin Note" : "Pin Note"}
                >
                    {note.is_pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
            </div>

            {/* Title */}
            <div className="px-8 pt-8 pb-4">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-3xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
                    placeholder="Note Title"
                />
            </div>

            {/* Editor Area */}
            <div className="flex-1 px-8 pb-8 overflow-y-auto">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full resize-none bg-transparent border-none focus:outline-none focus:ring-0 text-base leading-relaxed text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 font-mono"
                    placeholder="Start writing your strategy..."
                />
            </div>
        </div>
    );
}
