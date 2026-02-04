// Learning Flow™ v2 Types

// Lesson Videos
export type LessonVideo = {
    id: string;
    lesson_id: string;
    video_url: string;
    title: string | null;
    description: string | null;
    order_index: number;
    duration_seconds: number;
    thumbnail_url: string | null;
    is_published: boolean;
    created_at: string;
    updated_at: string;
};

// Template Visibility
export type TemplateVisibility = 'public' | 'learning_only' | 'staff_only';

// Mission Events
export type MissionEventType =
    | 'mission_started'
    | 'mission_completed'
    | 'mission_skipped'
    | 'bootcamp_started'
    | 'bootcamp_completed'
    | 'mission_incomplete_24h'
    | 'user_inactive_24h';

export type MissionEvent = {
    id: string;
    user_id: string;
    event_type: MissionEventType;
    payload: Record<string, any>;
    lesson_id: string | null;
    bootcamp_id: string | null;
    generation_id: string | null;
    webhook_sent: boolean;
    webhook_sent_at: string | null;
    created_at: string;
};

// Extended Lesson with videos
export type LessonWithVideos = {
    id: string;
    bootcamp_id: string;
    title: string;
    slug: string;
    order_index: number;
    learning_objective: string | null;
    duration_minutes: number;
    content_type: 'video' | 'text' | 'both';
    video_url: string | null; // Legacy single video
    text_content: string | null;
    create_action_type: 'prompt_template' | 'template_pack' | 'guided_remix';
    create_action_payload: {
        template_id?: string;
        template_ids?: string[];
        pack_id?: string;
    };
    create_action_label: string;
    create_action_description: string | null;
    auto_save_output: boolean;
    is_published: boolean;
    video_count: number;
    videos?: LessonVideo[];
    created_at: string;
    updated_at: string;
};

// Mission Studio context (passed via search params or state)
export type MissionContext = {
    lessonId: string;
    bootcampId: string;
    bootcampSlug: string;
    lessonSlug: string;
    templateId?: string;
    templateIds?: string[];
};

// Mission Completion response
export type MissionCompleteResponse = {
    success: boolean;
    lesson_progress: {
        id: string;
        status: string;
        generation_id: string | null;
        completed_at: string;
    };
    bootcamp_progress: {
        lessons_completed: number;
        lessons_skipped: number;
    };
    next_lesson?: {
        id: string;
        slug: string;
        title: string;
    } | null;
    is_bootcamp_complete: boolean;
    event_id?: string;
};

// Re-export existing types
export * from './learning-flow';
