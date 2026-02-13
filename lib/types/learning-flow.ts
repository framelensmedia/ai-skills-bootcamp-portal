// Learning Flow™ Types

export type Bootcamp = {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    thumbnail_url: string | null;
    access_level: 'free' | 'premium';
    lesson_count: number;
    total_duration_minutes: number;
    is_published: boolean;
    is_featured?: boolean;
    created_at: string;
    updated_at: string;
};

export type CreateActionType = 'prompt_template' | 'template_pack' | 'guided_remix';

export type CreateActionPayload = {
    template_id?: string;
    template_ids?: string[];
    pack_id?: string;
};

export type Lesson = {
    id: string;
    bootcamp_id: string;
    title: string;
    slug: string;
    order_index: number;
    learning_objective: string | null;
    duration_minutes: number;
    content_type: 'video' | 'text' | 'both';
    video_url: string | null;
    text_content: string | null;
    create_action_type: CreateActionType;
    create_action_payload: CreateActionPayload;
    create_action_label: string;
    create_action_description: string | null;
    auto_save_output: boolean;
    is_published: boolean;
    created_at: string;
    updated_at: string;
};

export type LessonProgressStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';

export type LessonProgress = {
    id: string;
    user_id: string;
    lesson_id: string;
    bootcamp_id: string;
    status: LessonProgressStatus;
    generation_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

export type BootcampProgress = {
    id: string;
    user_id: string;
    bootcamp_id: string;
    current_lesson_index: number;
    lessons_completed: number;
    lessons_skipped: number;
    started_at: string;
    completed_at: string | null;
    last_accessed_at: string;
};

// Extended types for UI
export type LessonWithProgress = Lesson & {
    progress?: LessonProgress;
    content_progress?: { content_id: string; is_completed: boolean }[];
};

export type BootcampWithLessons = Bootcamp & {
    lessons: LessonWithProgress[];
    user_progress?: BootcampProgress;
};

// API Response types
export type BootcampListResponse = {
    bootcamps: Bootcamp[];
    user_progress?: Record<string, BootcampProgress>;
};

export type BootcampDetailResponse = BootcampWithLessons;

export type LessonCompleteRequest = {
    generation_id?: string;
};

export type LessonCompleteResponse = {
    success: boolean;
    lesson_progress: LessonProgress;
    bootcamp_progress: BootcampProgress;
    next_lesson?: Lesson | null;
};
