"use client";

import LessonBuilder from "./LessonBuilder";

export type LessonContentItem = {
    id?: string;
    type: "video" | "exercise" | "celebration" | "text";
    title: string;
    order_index: number;
    content: {
        // Video specific
        video_url?: string;
        duration_seconds?: number;
        thumbnail_url?: string;
        description?: string;

        // Exercise specific (Action)
        question?: string; // Reused for text content? Or use new field? LessonBuilder uses 'question' for text content.
        options?: string[]; // For multiple choice or [Template Title, Image URL]
        correct_answer_index?: number;
        explanation?: string; // Reused for Template ID in Action

        // Text specific
        // We are reusing 'question' for text content in LessonBuilder for now to avoid migration if possible, 
        // but cleaner to add 'markdown' or similar. 
        // User prompt said "supporting test should be the text box element".
        // LessonBuilder uses: `item.content.question` for text.
    };
    is_published?: boolean;
};

type Props = {
    items: LessonContentItem[];
    onChange: (items: LessonContentItem[]) => void;
};

export default function LessonContentManager(props: Props) {
    // @ts-ignore - Types are compatible enough for this passthrough
    return <LessonBuilder {...props} />;
}
