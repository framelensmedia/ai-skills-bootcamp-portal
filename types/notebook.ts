export interface NotebookFolder {
    id: string;
    user_id: string;
    parent_id: string | null;
    name: string;
    created_at: string;
    updated_at: string;
    // UI helper for tree structure
    children?: NotebookFolder[];
}

export interface NotebookNote {
    id: string;
    user_id: string;
    folder_id: string | null;
    title: string;
    content: string; // Markdown
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

export interface NotebookChat {
    id: string;
    user_id: string;
    folder_id: string | null;
    title: string;
    summary: string | null;
    created_at: string;
    updated_at: string;
}

export interface NotebookMessage {
    id: string;
    chat_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, any>;
    created_at: string;
}
