import { useState, useEffect } from "react";
import { NotebookFolder, NotebookNote } from "@/types/notebook";
import { ChevronRight, ChevronDown, Folder, FileText, Plus, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotebookSidebarProps {
    folders: NotebookFolder[];
    notes: NotebookNote[];
    selectedFolderId: string | null;
    selectedNoteId: string | null;
    onSelectFolder: (id: string | null) => void;
    onSelectNote: (id: string) => void;
    onCreateFolder: (name: string, parentId?: string) => void;
    onCreateNote: () => void;
}

export function NotebookSidebar({
    folders,
    notes,
    selectedFolderId,
    selectedNoteId,
    onSelectFolder,
    onSelectNote,
    onCreateFolder,
    onCreateNote
}: NotebookSidebarProps) {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleFolder = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedFolders);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedFolders(next);
    };

    const renderFolder = (folder: NotebookFolder, depth = 0) => {
        const hasChildren = folder.children && folder.children.length > 0;
        const isExpanded = expandedFolders.has(folder.id);
        const isSelected = selectedFolderId === folder.id;

        return (
            <div key={folder.id}>
                <div
                    className={cn(
                        "flex items-center px-2 py-1.5 cursor-pointer text-sm rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        isSelected && "bg-zinc-100 dark:bg-zinc-800 font-medium text-emerald-600 dark:text-emerald-400"
                    )}
                    style={{ paddingLeft: `${depth * 12 + 8}px` }}
                    onClick={() => onSelectFolder(folder.id)}
                >
                    <span
                        onClick={(e) => toggleFolder(folder.id, e)}
                        className="mr-1 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"
                    >
                        {hasChildren ? (
                            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                        ) : (
                            <div className="w-4 h-4" />
                        )}
                    </span>
                    <Folder className={cn("w-4 h-4 mr-2", isSelected ? "fill-emerald-100 dark:fill-emerald-900/30 text-emerald-500" : "text-zinc-400")} />
                    <span className="truncate">{folder.name}</span>
                </div>
                {isExpanded && hasChildren && (
                    <div>
                        {folder.children!.map(child => renderFolder(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    const pinnedNotes = notes.filter(n => n.is_pinned);
    const unpinnedNotes = notes.filter(n => !n.is_pinned);

    return (
        <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 h-full flex flex-col bg-white dark:bg-black/40">
            {/* Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h2 className="font-semibold text-sm tracking-tight text-zinc-900 dark:text-white">Notebook</h2>
                <button onClick={() => onCreateFolder("New Project")} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Folders */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="text-xs font-medium text-zinc-500 mb-2 px-2 uppercase tracking-wider">Storage</div>
                <div
                    className={cn(
                        "flex items-center px-2 py-1.5 mb-2 cursor-pointer text-sm rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800",
                        selectedFolderId === null && "bg-zinc-100 dark:bg-zinc-800 font-medium"
                    )}
                    onClick={() => onSelectFolder(null)}
                >
                    <span className="w-6 mr-1" />
                    <Folder className="w-4 h-4 mr-2 text-zinc-400" />
                    <span>All Notes</span>
                </div>
                {folders.map(f => renderFolder(f))}
            </div>

            {/* Notes List (Contextual to selected folder) */}
            <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800 overflow-y-auto p-2">
                <div className="flex items-center justify-between mb-2 px-2">
                    <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Notes</div>
                    <button onClick={onCreateNote} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded" title="New Note">
                        <Plus className="w-3 h-3" />
                    </button>
                </div>

                {notes.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-zinc-500">
                        No notes yet.<br />Create one to start writing.
                    </div>
                )}

                {notes.map(note => (
                    <div
                        key={note.id}
                        onClick={() => onSelectNote(note.id)}
                        className={cn(
                            "group flex items-start px-2 py-2 cursor-pointer text-sm rounded-md transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800",
                            selectedNoteId === note.id && "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800"
                        )}
                    >
                        <FileText className={cn("w-4 h-4 mt-0.5 mr-2 shrink-0", selectedNoteId === note.id ? "text-blue-500" : "text-zinc-400")} />
                        <div className="min-w-0">
                            <div className="font-medium truncate">{note.title || "Untitled Note"}</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {new Date(note.updated_at).toLocaleDateString()}
                            </div>
                        </div>
                        {note.is_pinned && <Pin className="w-3 h-3 ml-auto text-zinc-400" />}
                    </div>
                ))}
            </div>
        </div>
    );
}
