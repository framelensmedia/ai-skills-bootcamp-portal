"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookFolder, NotebookNote } from "@/types/notebook";
import { NotebookSidebar } from "@/components/notebook/NotebookSidebar";
import { NotebookEditor } from "@/components/notebook/NotebookEditor";
import { createSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { toast } from "sonner";

import { Suspense } from "react";

function NotebookContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const folderIdParam = searchParams.get("folderId");

    const [folders, setFolders] = useState<NotebookFolder[]>([]);
    const [notes, setNotes] = useState<NotebookNote[]>([]);

    // Initialize state from URL
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderIdParam);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [currentNote, setCurrentNote] = useState<NotebookNote | null>(null);

    const supabase = createSupabaseBrowserClient();

    // URL Sync: When internal state changes, update URL
    useEffect(() => {
        if (selectedFolderId) {
            router.push(`?folderId=${selectedFolderId}`);
        } else {
            router.push("?");
        }
    }, [selectedFolderId, router]);

    // Load Folders
    useEffect(() => {
        fetch("/api/notebook/folders")
            .then(res => res.json())
            .then(data => {
                if (data.folders) setFolders(data.folders);
            });
    }, []);

    // Load Notes when folder changes
    useEffect(() => {
        let url = "/api/notebook/notes";
        if (selectedFolderId) url += `?folderId=${selectedFolderId}`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.notes) setNotes(data.notes);
            });
    }, [selectedFolderId]);

    // Load Note Content
    useEffect(() => {
        if (selectedNoteId) {
            const note = notes.find(n => n.id === selectedNoteId);
            if (note) setCurrentNote(note);
        } else {
            setCurrentNote(null);
        }
    }, [selectedNoteId, notes]);

    const handleCreateFolder = async (name: string) => {
        const folderName = prompt("Folder Name:", "New Project");
        if (!folderName) return;

        const res = await fetch("/api/notebook/folders", {
            method: "POST",
            body: JSON.stringify({ name: folderName, parent_id: selectedFolderId })
        });
        const data = await res.json();
        if (data.folder) {
            setFolders(prev => [...prev, data.folder]);
            toast.success("Folder created");
        }
    };

    const handleCreateNote = async () => {
        const res = await fetch("/api/notebook/notes", {
            method: "POST",
            body: JSON.stringify({
                title: "Untitled Note",
                folder_id: selectedFolderId
            })
        });
        const data = await res.json();
        if (data.note) {
            setNotes(prev => [data.note, ...prev]);
            setSelectedNoteId(data.note.id);
            toast.success("Note created");
        }
    };

    const handleUpdateNote = async (id: string, updates: Partial<NotebookNote>) => {
        // Optimistic update
        setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));

        await fetch("/api/notebook/notes", {
            method: "POST",
            body: JSON.stringify({ id, ...updates })
        });
    };

    return (
        <div className="flex h-[calc(100vh-64px)] w-full bg-white dark:bg-black text-zinc-900 dark:text-zinc-100 overflow-hidden">
            {/* Sidebar */}
            <NotebookSidebar
                folders={folders}
                notes={notes}
                selectedFolderId={selectedFolderId}
                selectedNoteId={selectedNoteId}
                onSelectFolder={setSelectedFolderId}
                onSelectNote={setSelectedNoteId}
                onCreateFolder={handleCreateFolder}
                onCreateNote={handleCreateNote}
            />

            {/* Editor (Expanded to fill remaining space) */}
            <main className="flex-1 min-w-0 border-r border-zinc-200 dark:border-zinc-800">
                <NotebookEditor
                    note={currentNote}
                    onUpdate={handleUpdateNote}
                />
            </main>
        </div>
    );
}

export default function NotebookPage() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading Notebook...</div>}>
            <NotebookContent />
        </Suspense>
    );
}
